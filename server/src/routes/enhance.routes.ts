import { Router } from 'express';
import { z } from 'zod';
import { authRequired } from '../middleware/auth';
import { prisma } from '../db/prisma';
import { logger } from '../utils/logger';

const router = Router();

const enhanceSchema = z.object({
  query: z.string().min(1),
});

router.post('/', authRequired, async (req, res, next) => {
  try {
    const parsed = enhanceSchema.parse(req.body);
    const userId = req.user!.sub;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { geminiApiKey: true, geminiModel: true }
    });

    if (!user || !user.geminiApiKey) {
      res.status(400).json({ error: 'Gemini API key not configured. Please add it in your profile settings.' });
      return;
    }

    const model = 'gemini-flash-lite-latest';
    const apiKey = user.geminiApiKey;

    const prompt = `You are an expert medical search query rewriter. Your task is to transform a raw user query into a single, fluent, grammatically correct question suitable for searching a large biomedical literature database. Follow these rules strictly:
1. Correct any spelling mistakes and grammatical errors.
2. Expand abbreviations and replace layman terms with their standard medical terminology (e.g., "BP" → "blood pressure", "heart attack" → "myocardial infarction", "high cholesterol" → "hypercholesterolemia").
3. Preserve the exact relationship expressed in the query: if the user asks about causation, effect, treatment, prevention, or association, ensure the rewritten question clearly conveys that same relationship (subject-verb-object or similar).
4. Do not add new medical facts, opinions, or extraneous details – only rephrase what is given.
5. Output only the rewritten question, with no additional commentary, explanations, or disclaimers.

Rules:
- Output ONLY the enhanced query.
- Do NOT output any explanations, formatting, or introductory text.
- Do NOT use quotes, punctuation around the output.
- Keep it precise , concise but comprehensive enough to catch relevant medical literature.

Original query: ${parsed.query}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.1
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ error: errorText, status: response.status }, 'Gemini API error');

      let clientMsg = 'Failed to enhance query with Gemini API. Check your API key.';
      try {
        const errObj = JSON.parse(errorText);
        if (errObj.error && errObj.error.message) {
          clientMsg = `Gemini API Error: ${errObj.error.message}`;
        }
      } catch (e) { }

      res.status(502).json({ error: clientMsg });
      return;
    }

    const data = await response.json() as any;
    const enhancedQuery = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || parsed.query;

    res.json({ enhancedQuery });
  } catch (e) {
    next(e);
  }
});

export default router;

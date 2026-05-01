const express = require('express');
const router = express.Router();

const HF_API_KEY = process.env.HF_API_KEY;
const MODEL = 'meta-llama/Llama-3.1-8B-Instruct:cerebras';

const SYSTEM_PROMPT = `You are Dress the Day's style assistant. Dress the Day is a clothing rental platform where users can rent outfits for specific occasions across three categories: Holiday & Party, Cultural & Traditional, and Wedding & Formal. Your job is to help users find the right outfit, understand sizing and fit, learn about the rental process (3-30 day rentals, free shipping both ways, free backup size), answer questions about returns, extensions and pricing, and give styling advice. Keep responses friendly, concise, and fashion-forward. Do not make up specific product names or prices.`;

router.post('/', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('HF API error:', response.status, errText);
      return res.status(502).json({ error: 'AI model request failed' });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) return res.status(502).json({ error: 'No response from AI model' });
    res.json({ reply });

  } catch (err) {
    console.error('HF chat error:', err?.message || err);
    res.status(500).json({ error: 'Chat service unavailable.' });
  }
});

module.exports = router;
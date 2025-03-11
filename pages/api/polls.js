// pages/api/polls.js
import { createClient } from '@supabase/supabase-js';

// Creamos el cliente Supabase:
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Obtener encuestas
    try {
      const { data, error } = await supabase
        .from('surveys')    // asumiendo tu tabla se llama 'surveys'
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json(data);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
  } else if (req.method === 'POST') {
    // Crear encuesta
    try {
      const { question } = req.body;

      if (!question) {
        return res.status(400).json({ error: 'Missing question' });
      }

      const { data, error } = await supabase
        .from('surveys')
        .insert([{ question }])
        .single();

      if (error) throw error;
      return res.status(200).json(data);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
  } else {
    // Método no permitido
    return res.status(405).json({ error: 'Method not allowed' });
  }
}


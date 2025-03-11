// app.js
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

// Lee variables de entorno
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const app = express();
app.use(express.json());

/**
 * Función auxiliar que desactiva encuestas activas con más de 7 días.
 * Se ejecuta en cada request de la encuesta activa para mantener
 * solo encuestas vigentes en la última semana.
 */
async function expireOldSurveys() {
  try {
    // Obtenemos todas las encuestas que aún estén 'active = true'
    const { data: activeSurveys, error: activeSurveyError } = await supabase
      .from('surveys')
      .select('*')
      .eq('active', true);

    if (activeSurveyError) throw activeSurveyError;
    if (!activeSurveys || activeSurveys.length === 0) return;

    // Revisamos cada una si ha pasado una semana desde su creación
    const now = new Date();
    for (let survey of activeSurveys) {
      const createdAt = new Date(survey.created_at);
      const diffInMs = now - createdAt;
      const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
      if (diffInDays >= 7) {
        // Si tiene 7 días o más, la marcamos como inactiva
        const { error: updateError } = await supabase
          .from('surveys')
          .update({ active: false })
          .eq('id', survey.id);

        if (updateError) {
          console.error('Error al inactivar encuesta:', updateError);
        }
      }
    }
  } catch (err) {
    console.error('Error en expireOldSurveys:', err);
  }
}

/**
 * 1) Obtener la encuesta activa y sus resultados (% sí, % no, total votos).
 *    - Antes de devolver la encuesta activa, se llama a `expireOldSurveys()`
 *      para desactivar encuestas que hayan superado 1 semana.
 */
app.get('/api/active-survey', async (req, res) => {
  try {
    // Desactivamos encuestas expiradas
    await expireOldSurveys();

    // Ahora buscamos si queda alguna encuesta activa
    const { data: activeSurveys, error: activeSurveyError } = await supabase
      .from('surveys')
      .select('*')
      .eq('active', true)
      .limit(1);

    if (activeSurveyError) throw activeSurveyError;
    if (!activeSurveys || activeSurveys.length === 0) {
      // Si no hay encuesta activa, devolvemos null
      return res.json({ survey: null, results: null });
    }

    const activeSurvey = activeSurveys[0];

    // Contamos los votos de la encuesta activa
    const { data: votesData, error: votesError } = await supabase
      .from('votes')
      .select('vote_option')
      .eq('survey_id', activeSurvey.id);

    if (votesError) throw votesError;

    const totalVotes = votesData.length;
    const yesCount = votesData.filter(v => v.vote_option === 'yes').length;
    const noCount = votesData.filter(v => v.vote_option === 'no').length;

    const yesPercentage = totalVotes === 0 ? 0 : (yesCount / totalVotes) * 100;
    const noPercentage = totalVotes === 0 ? 0 : (noCount / totalVotes) * 100;

    res.json({
      survey: activeSurvey,
      results: {
        yesPercentage: yesPercentage.toFixed(2),
        noPercentage: noPercentage.toFixed(2),
        totalVotes
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 2) Obtener el histórico de encuestas (paginado a 100 si lo deseas).
 *    - Aquí se listan encuestas inactivas (active = false).
 */
app.get('/api/surveys/history', async (req, res) => {
  try {
    // Por simplicidad, devolvemos las últimas 100 encuestas inactivas.
    // (Puedes agregar paginación aquí también si es necesario.)
    const { data: pastSurveys, error } = await supabase
      .from('surveys')
      .select('*')
      .eq('active', false)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Calculamos estadísticas de votos por cada encuesta
    const resultsWithStats = [];
    for (let survey of pastSurveys) {
      const { data: votesData, error: votesError } = await supabase
        .from('votes')
        .select('vote_option')
        .eq('survey_id', survey.id);

      if (!votesError) {
        const total = votesData.length;
        const yesCount = votesData.filter(v => v.vote_option === 'yes').length;
        const noCount = votesData.filter(v => v.vote_option === 'no').length;

        resultsWithStats.push({
          ...survey,
          totalVotes: total,
          yesPercentage: total === 0 ? 0 : (yesCount / total) * 100,
          noPercentage: total === 0 ? 0 : (noCount / total) * 100
        });
      }
    }

    res.json({ history: resultsWithStats });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 3) Obtener el log de transacciones (votos) con paginación de 100.
 *    - Query param ?page=1,2,3,... para moverse en la paginación.
 *    - Se devuelve también el total de registros (count) y totalPages.
 */
app.get('/api/votes/log', async (req, res) => {
  try {
    const page = req.query.page ? parseInt(req.query.page) : 1;
    const limit = 100;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Supabase permite usar .range() y count para paginación
    const { data: votesData, error, count } = await supabase
      .from('votes')
      .select('id, created_at, survey_id, wallet_address', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const totalPages = Math.ceil(count / limit);

    res.json({
      votesLog: votesData,
      totalItems: count,
      totalPages,
      currentPage: page
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 4) Emitir un voto (vía POST).
 *    - El front-end maneja la conexión Metamask y la transacción on-chain.
 *    - Aquí solo recibimos `survey_id`, `wallet_address` y `vote_option` ('yes' o 'no').
 */
app.post('/api/vote', async (req, res) => {
  try {
    const { survey_id, wallet_address, vote_option } = req.body;

    // Validamos campos
    if (!survey_id || !wallet_address || !vote_option) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verificamos que la encuesta existe y está activa
    const { data: surveyData, error: surveyError } = await supabase
      .from('surveys')
      .select('*')
      .eq('id', survey_id)
      .eq('active', true);

    if (surveyError) throw surveyError;
    if (!surveyData || surveyData.length === 0) {
      return res.status(404).json({ error: 'Survey not found or not active' });
    }

    // Insertamos el voto (y con ello registramos la transacción)
    const { data: insertedVote, error: insertError } = await supabase
      .from('votes')
      .insert([
        {
          survey_id,
          wallet_address,
          vote_option
        }
      ]);

    if (insertError) throw insertError;

    res.json({ success: true, vote: insertedVote[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Exportamos para Vercel (o para uso local)
module.exports = app;

// Para desarrollo local:
// if (require.main === module) {
//   app.listen(3000, () => {
//     console.log('Server running on http://localhost:3000');
//   });
// }


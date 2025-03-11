// pages/index.js
import React, { useState, useEffect } from 'react';

export default function Home() {
  const [polls, setPolls] = useState([]);
  const [question, setQuestion] = useState('');
  const [error, setError] = useState(null);

  // useEffect para obtener las encuestas al montar
  useEffect(() => {
    const fetchPolls = async () => {
      try {
        const response = await fetch('/api/polls');
        if (!response.ok) {
          throw new Error('Error al obtener las encuestas');
        }
        const data = await response.json();
        setPolls(data);
      } catch (err) {
        console.error(err);
        setError(err.message);
      }
    };
    fetchPolls();
  }, []);

  // Crear una nueva encuesta
  const handleCreatePoll = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const response = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });
      if (!response.ok) {
        throw new Error('Error al crear la encuesta');
      }
      const newPoll = await response.json();

      // Insertamos al inicio del array
      setPolls((prev) => [newPoll, ...prev]);
      setQuestion('');
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Encuestas</h1>

      <form onSubmit={handleCreatePoll} style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Escribe tu pregunta"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button type="submit">Crear encuesta</button>
      </form>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {polls.length === 0 ? (
        <p>No hay encuestas.</p>
      ) : (
        <ul>
          {polls.map((poll) => (
            <li key={poll.id}>
              <strong>{poll.question}</strong> – Creada: {poll.created_at}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


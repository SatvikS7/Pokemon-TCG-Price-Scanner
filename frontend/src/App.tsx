import { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('http://localhost:3001');
        setMessage(response.data);
      } catch (error) {
        console.error('Error connecting to backend:', error);
      }
    };
    fetchData();
  }, []);

  return (
    <div>
      <h1>Pokémon Card Price Checker</h1>
      <p>Backend says: {message}</p>
    </div>
  );
}

export default App;

import React, { useEffect, useState } from 'react';

interface PokemonSet {
  id: string;
  name: string;
  series: string;
}

const SetSelector: React.FC<{ onSelect: (set: PokemonSet) => void }> = ({ onSelect }) => {
  const [sets, setSets] = useState<PokemonSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<string>("");

  useEffect(() => {
    fetch('https://api.pokemontcg.io/v2/sets')
      .then((res) => res.json())
      .then((data) => {
        const sorted = data.data.sort((a: PokemonSet, b: PokemonSet) => a.name.localeCompare(b.name));
        setSets(sorted);
      })
      .catch((err) => console.error('Failed to fetch sets:', err));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    setSelectedSetId(selectedId);
    const selectedSet = sets.find((set) => set.id === selectedId);
    if (selectedSet) {
      onSelect(selectedSet);
    }
  };

  return (
    <div className="my-4">
      <label htmlFor="set-select" className="block font-semibold text-gray-700 mb-2">
        Choose a set:
      </label>
      <select
        id="set-select"
        value={selectedSetId}
        onChange={handleChange}
        className="border border-gray-300 rounded p-2 w-full"
      >
        <option value="">-- Select a Set --</option>
        {sets.map((set) => (
          <option key={set.id} value={set.id}>
            {set.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default SetSelector;

import React, { useState, useEffect } from 'react';

interface Condominium {
  id: string;
  name: string;
}

interface GatewaySelectorProps {
  onSelectCondo: (condoId: string) => void;
  onClose?: () => void;
}

export const GatewaySelectorForAdmin: React.FC<GatewaySelectorProps> = ({ 
  onSelectCondo, 
  onClose 
}) => {
  const [condos, setCondos] = useState<Condominium[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCondoId, setSelectedCondoId] = useState<string>('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadCondominiums();
  }, []);

  const loadCondominiums = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/condos', {
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });

      if (res.ok) {
        const data = await res.json();
        setCondos(data || []);
      }
    } catch (error) {
      console.error('Error ao carregar condomínios:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCondo = (condoId: string) => {
    setSelectedCondoId(condoId);
    onSelectCondo(condoId);
  };

  const filteredCondos = condos.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <span className="text-xl">🏢</span> Selecionar Condomínio
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Escolha o condomínio para gerenciar o gateway de pagamento
        </p>
      </div>

      {/* Search */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <input
          type="text"
          placeholder="Buscar condomínio..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Condominium List */}
      <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
        {loading ? (
          <div className="px-6 py-8 text-center text-gray-500">
            Carregando condomínios...
          </div>
        ) : filteredCondos.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            Nenhum condomínio encontrado
          </div>
        ) : (
          filteredCondos.map(condo => (
            <button
              key={condo.id}
              onClick={() => handleSelectCondo(condo.id)}
              className={`w-full text-left px-6 py-4 hover:bg-gray-50 transition-colors ${
                selectedCondoId === condo.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{condo.name}</p>
                  <p className="text-sm text-gray-500">ID: {condo.id.slice(0, 8)}...</p>
                </div>
                {selectedCondoId === condo.id && (
                  <div className="text-indigo-600 text-xl">✓</div>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      {onClose && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              if (selectedCondoId) onClose?.();
            }}
            disabled={!selectedCondoId}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirmar
          </button>
        </div>
      )}
    </div>
  );
};

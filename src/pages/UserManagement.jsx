import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Upload, Building } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { toast } from 'sonner'; // Assumindo que a biblioteca sonner está disponível

// Componente de gerenciamento de usuários
export default function UserManagement() {
  const [condos, setCondos] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCondo, setSelectedCondo] = useState(null);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Carregar dados reais da API
  useEffect(() => {
    fetchData();
  }, []);

  // Filtrar usuários com base no termo de pesquisa
  useEffect(() => {
    if (selectedCondo) {
      const filtered = users.filter(user =>
        user.condoId === selectedCondo.id &&
        (
          user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.cpf?.includes(searchTerm) ||
          user.phone?.includes(searchTerm)
        )
      );
      setFilteredUsers(filtered);
    }
  }, [searchTerm, users, selectedCondo]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Buscar condomínios e usuários
      const [condosResponse, usersResponse] = await Promise.all([
        fetch('/api/condos'),
        fetch('/api/users')
      ]);
      
      if (condosResponse.ok && usersResponse.ok) {
        const condosData = await condosResponse.json();
        const usersData = await usersResponse.json();
        
        setCondos(condosData);
        setUsers(usersData);
      } else {
        throw new Error('Falha ao carregar dados');
      }
    } catch (error) {
      console.error('Error ao carregar dados:', error);
      toast.error('Error ao carregar lista de condomínios e usuários');
    } finally {
      setLoading(false);
    }
  };

  const handleCondoSelect = (condo) => {
    setSelectedCondo(condo);
    // Filtrar usuários para o condomínio selecionado
    const condoUsers = users.filter(user => user.condoId === condo.id);
    setFilteredUsers(condoUsers);
    setSearchTerm('');
  };

  const handleBackToList = () => {
    setSelectedCondo(null);
    setFilteredUsers([]);
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleDelete = async (userId) => {
    if (window.confirm('Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.')) {
      try {
        const response = await fetch(`/api/users/${userId}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          // Atualizar ambas as listas
          setUsers(users.filter(user => user.id !== userId));
          setFilteredUsers(filteredUsers.filter(user => user.id !== userId));
          toast.success('Usuário excluído com sucesso');
        } else {
          throw new Error('Falha ao excluir usuário');
        }
      } catch (error) {
        console.error('Error ao excluir usuário:', error);
        toast.error('Error ao excluir usuário');
      }
    }
  };

  const handleSaveUser = async (userData) => {
    try {
      let response;
      if (editingUser) {
        // Atualizar usuário existente
        response = await fetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(userData),
        });
      } else {
        // Adicionar novo usuário
        response = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...userData,
            active: true,
            createdAt: new Date().toISOString(),
            password: '123456', // Senha padrão para novos usuários
            role: userData.role || 'morador',
            condoId: selectedCondo?.id || userData.condoId
          }),
        });
      }

      if (response.ok) {
        const savedUser = await response.json();
        
        if (editingUser) {
          // Atualizar usuário existente nas listas
          setUsers(users.map(u => u.id === editingUser.id ? savedUser : u));
          setFilteredUsers(filteredUsers.map(u => u.id === editingUser.id ? savedUser : u));
        } else {
          // Adicionar novo usuário às listas
          setUsers([...users, savedUser]);
          setFilteredUsers([...filteredUsers, savedUser]);
        }
        
        toast.success(editingUser ? 'Usuário atualizado com sucesso' : 'Usuário criado com sucesso');
        setIsModalOpen(false);
        setEditingUser(null);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao salvar usuário');
      }
    } catch (error) {
      console.error('Error ao salvar usuário:', error);
      toast.error(`Error ao ${editingUser ? 'atualizar' : 'criar'} usuário: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 flex justify-center items-center">
        <div className="text-lg">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      {!selectedCondo ? (
        // Visualização de lista de condomínios
        <Card>
          <CardHeader>
            <CardTitle>Lista de Condomínios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {condos.map((condo) => (
                <div 
                  key={condo.id} 
                  className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleCondoSelect(condo)}
                >
                  <div className="flex items-center">
                    <Building className="w-6 h-6 mr-2 text-blue-500" />
                    <h3 className="font-semibold text-lg">{condo.name}</h3>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">{condo.address}</p>
                  <p className="text-gray-600 text-sm">{condo.city}</p>
                  <p className="text-gray-700 font-medium mt-2">{condo.units} unidades • {condo.residents} residentes</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        // Visualização de detalhes do condomínio e seus usuários
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center">
                  <button 
                    onClick={handleBackToList}
                    className="mr-3 text-gray-500 hover:text-gray-700"
                  >
                    &larr;
                  </button>
                  Usuários - {selectedCondo.name}
                </CardTitle>
                <p className="text-gray-600 text-sm mt-1">{selectedCondo.address}, {selectedCondo.city}</p>
              </div>
              <Button 
                onClick={() => {
                  setEditingUser(null);
                  setIsModalOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Usuário
              </Button>
            </div>
            
            <div className="mt-4 flex space-x-2">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Buscar usuários..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPF</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telefone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cargo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unidade</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap">{user.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{user.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{user.cpf || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{user.phone || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                          user.role === 'sindico' ? 'bg-blue-100 text-blue-800' :
                          user.role === 'porteiro' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{user.unit || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {user.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(user)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredUsers.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Nenhum usuário encontrado {searchTerm ? `para "${searchTerm}"` : 'neste condomínio'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de Edição/Criação de Usuário */}
      {isModalOpen && (
        <UserModal
          user={editingUser}
          onSave={handleSaveUser}
          onClose={() => {
            setIsModalOpen(false);
            setEditingUser(null);
          }}
          condoId={selectedCondo?.id}
        />
      )}
    </div>
  );
}

// Componente modal para edição/criação de usuário
function UserModal({ user, onSave, onClose, condoId }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'morador',
    cpf: '',
    phone: '',
    unit: '',
    active: true
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        role: user.role || 'morador',
        cpf: user.cpf || '',
        phone: user.phone || '',
        unit: user.unit || '',
        active: user.active !== undefined ? user.active : true
      });
    } else {
      setFormData({
        name: '',
        email: '',
        role: 'morador',
        cpf: '',
        phone: '',
        unit: '',
        active: true
      });
    }
  }, [user]);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email é obrigatório';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }
    
    if (!formData.cpf.trim()) {
      newErrors.cpf = 'CPF é obrigatório';
    } else if (!/^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/.test(formData.cpf.replace(/[.-]/g, ''))) {
      newErrors.cpf = 'CPF inválido';
    }
    
    if (!formData.phone.trim()) {
      newErrors.phone = 'Telefone é obrigatório';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    // Adicionando o condoId ao formData se for um novo usuário
    const userData = {
      ...formData,
      ...(condoId && !user ? { condoId } : {})
    };
    await onSave(userData);
    setLoading(false);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
    
    // Limpar erro quando o usuário digita
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-medium mb-4">
          {user ? 'Editar Usuário' : 'Criar Novo Usuário'}
        </h3>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nome</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`mt-1 block w-full border ${errors.name ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm p-2`}
                required
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`mt-1 block w-full border ${errors.email ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm p-2`}
                required
              />
              {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">CPF</label>
              <input
                type="text"
                name="cpf"
                value={formData.cpf}
                onChange={handleChange}
                className={`mt-1 block w-full border ${errors.cpf ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm p-2`}
                placeholder="000.000.000-00"
                required
              />
              {errors.cpf && <p className="mt-1 text-sm text-red-600">{errors.cpf}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Telefone</label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className={`mt-1 block w-full border ${errors.phone ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm p-2`}
                required
              />
              {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Unidade</label>
              <input
                type="text"
                name="unit"
                value={formData.unit}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                placeholder="Ex: 101-A"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Cargo</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              >
                <option value="admin">Administrador</option>
                <option value="sindico">Síndico</option>
                <option value="porteiro">Porteiro</option>
                <option value="morador">Morador</option>
              </select>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                name="active"
                checked={formData.active}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-700">Ativo</label>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end space-x-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
            >
              {loading ? 'Salvando...' : (user ? 'Atualizar' : 'Criar')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
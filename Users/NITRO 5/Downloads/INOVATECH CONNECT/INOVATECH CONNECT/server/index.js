
// Users API
app.get('/api/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id }
    });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Endpoint para criar um novo usuário
app.post('/api/users', async (req, res) => {
  try {
    const { name, email, role, cpf, phone, condoId, unit, password, active } = req.body;

    // Verificar se o email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Email já está em uso.' });
    }

    // Criar novo usuário
    const hashedPassword = await bcrypt.hash(password || '123456', 10);
    const newUser = await prisma.user.create({
      data: {
        id: `u${Date.now()}`, // Gerar ID único
        name,
        email,
        role: role || 'morador',
        cpf,
        phone,
        condoId: condoId || null,
        unit: unit || null,
        password: hashedPassword,
        active: active !== undefined ? active : true,
        createdAt: new Date(),
        canViewCharges: false
      }
    });

    res.status(201).json(newUser);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: error.message });
  }
});

// Endpoint para atualizar um usuário
app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, cpf, phone, condoId, unit, active, canViewCharges } = req.body;

    // Verificar se o usuário existe
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verificar se o email novo é diferente do atual e se já está sendo usado por outro usuário
    if (email !== existingUser.email) {
      const emailExists = await prisma.user.findFirst({
        where: {
          email,
          NOT: { id }
        }
      });

      if (emailExists) {
        return res.status(400).json({ message: 'Email já está em uso por outro usuário.' });
      }
    }

    // Atualizar usuário
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        name,
        email,
        role,
        cpf,
        phone,
        condoId: condoId || null,
        unit: unit || null,
        active,
        canViewCharges
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: error.message });
  }
});

// Endpoint para excluir um usuário
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se o usuário existe
    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Não permitir excluir o admin master (primeiro usuário)
    if (user.id === 'u1') {
      return res.status(403).json({ message: 'Não é possível excluir o usuário admin master.' });
    }

    // Excluir o usuário
    await prisma.user.delete({
      where: { id }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: error.message });
  }
});

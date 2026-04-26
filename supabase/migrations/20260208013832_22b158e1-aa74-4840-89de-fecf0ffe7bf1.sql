-- Habilitar realtime para a tabela profiles (contador de usuários em tempo real)
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
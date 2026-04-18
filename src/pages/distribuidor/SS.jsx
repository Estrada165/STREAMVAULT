//para eliminar un correo defe¿initivamente se ejecuta: 
//DELETE FROM auth.users WHERE email = 'correo@ejemplo.com';
// para cambiar la contra es -- Cambiar contraseña (reemplaza email y nueva contraseña)
//UPDATE auth.users 
//SET encrypted_password = crypt('NUEVA_CONTRASEÑA_AQUI', gen_salt('bf'))
//WHERE email = 'correo@ejemplo.com';
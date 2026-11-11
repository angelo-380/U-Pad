/**
 * Política de robustez de contraseñas de U-Pad (Enterprise Security Policy):
 * - Mínimo 8 caracteres
 * - Al menos una letra mayúscula
 * - Al menos un dígito numérico
 * - Al menos un carácter especial (@$!%*?&#/_-...)
 *
 * Devuelve null si la contraseña es válida; en caso contrario, un objeto
 * { message, field, code } listo para construir un AppError.
 */
export const validarPassword = (password) => {
  if (typeof password !== 'string' || password.length < 8) {
    return {
      message: 'La contraseña debe tener al menos 8 caracteres.',
      field: 'password',
      code: 'PASSWORD_TOO_SHORT',
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      message: 'La contraseña debe contener al menos una letra mayúscula.',
      field: 'password',
      code: 'PASSWORD_NO_UPPERCASE',
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      message: 'La contraseña debe contener al menos un número.',
      field: 'password',
      code: 'PASSWORD_NO_DIGIT',
    };
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    return {
      message: 'La contraseña debe contener al menos un carácter especial (!@#$%^&*...).',
      field: 'password',
      code: 'PASSWORD_NO_SPECIAL',
    };
  }

  return null;
};

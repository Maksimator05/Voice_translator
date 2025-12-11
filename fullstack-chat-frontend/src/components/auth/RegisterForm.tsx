import React, { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useAppDispatch, useAppSelector } from '../../hooks/useRedux';
import { register, clearError } from '../../store/authSlice';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  Visibility,
  VisibilityOff,
  Email,
  Lock,
  Person,
} from '@mui/icons-material';

const validationSchema = Yup.object({
  username: Yup.string()
    .min(3, 'Username must be at least 3 characters')
    .required('Username is required'),
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Confirm password is required'),
});

export const RegisterForm: React.FC<{ onToggle: () => void }> = ({ onToggle }) => {
  const dispatch = useAppDispatch();
  const { isLoading, error } = useAppSelector((state) => state.auth);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const formik = useFormik({
    initialValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
    validationSchema,
    onSubmit: async (values) => {
      const { confirmPassword, ...credentials } = values;
      await dispatch(register(credentials));
    },
  });

  React.useEffect(() => {
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
          AI Chat Assistant
        </h1>
        <p className="text-gray-400">
          Create your account to start chatting
        </p>
      </div>

      <div className="flex justify-center mb-6">
        <div className="inline-flex rounded-lg border border-gray-700 p-1 bg-gray-900">
          <button
            type="button"
            onClick={onToggle}
            className="px-6 py-2 rounded-md text-gray-400 hover:text-white transition-colors"
          >
            Sign In
          </button>
          <button
            type="button"
            className="px-6 py-2 rounded-md bg-gradient-to-r from-purple-600 to-pink-500 text-white font-medium"
          >
            Sign Up
          </button>
        </div>
      </div>

      <form onSubmit={formik.handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="relative">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-400">
            <Person className="w-5 h-5" />
          </div>
          <Input
            type="text"
            name="username"
            value={formik.values.username}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.username && formik.errors.username}
            placeholder="Username"
            className="pl-10 bg-gray-800 border-gray-700 text-white focus:border-purple-500 focus:ring-purple-500"
          />
        </div>

        <div className="relative">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-400">
            <Email className="w-5 h-5" />
          </div>
          <Input
            type="email"
            name="email"
            value={formik.values.email}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.email && formik.errors.email}
            placeholder="Email address"
            className="pl-10 bg-gray-800 border-gray-700 text-white focus:border-purple-500 focus:ring-purple-500"
          />
        </div>

        <div className="relative">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-400">
            <Lock className="w-5 h-5" />
          </div>
          <Input
            type={showPassword ? 'text' : 'password'}
            name="password"
            value={formik.values.password}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.password && formik.errors.password}
            placeholder="Password"
            className="pl-10 bg-gray-800 border-gray-700 text-white focus:border-purple-500 focus:ring-purple-500"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
          >
            {showPassword ? (
              <VisibilityOff className="w-5 h-5" />
            ) : (
              <Visibility className="w-5 h-5" />
            )}
          </button>
        </div>

        <div className="relative">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-400">
            <Lock className="w-5 h-5" />
          </div>
          <Input
            type={showConfirmPassword ? 'text' : 'password'}
            name="confirmPassword"
            value={formik.values.confirmPassword}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.confirmPassword && formik.errors.confirmPassword}
            placeholder="Confirm password"
            className="pl-10 bg-gray-800 border-gray-700 text-white focus:border-purple-500 focus:ring-purple-500"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
          >
            {showConfirmPassword ? (
              <VisibilityOff className="w-5 h-5" />
            ) : (
              <Visibility className="w-5 h-5" />
            )}
          </button>
        </div>

        <Button
          type="submit"
          isLoading={isLoading}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white font-medium rounded-lg"
        >
          Create Account
        </Button>
      </form>

      <div className="mt-6 text-center">
        <button
          onClick={onToggle}
          className="text-purple-400 hover:text-purple-300 transition-colors"
        >
          Already have an account? Sign in
        </button>
      </div>

      <div className="mt-8 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
        <p className="text-sm text-gray-400 mb-3 text-center">
          By registering, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
};
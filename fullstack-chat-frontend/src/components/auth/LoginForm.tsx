import React, { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useAppDispatch, useAppSelector } from '../../hooks/useRedux';
import { login, clearError } from '../../store/authSlice';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Link } from 'react-router-dom';
import {
  Visibility,
  VisibilityOff,
  Email,
  Lock,
  Person,
} from '@mui/icons-material';

const validationSchema = Yup.object({
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
});

export const LoginForm: React.FC<{ onToggle: () => void }> = ({ onToggle }) => {
  const dispatch = useAppDispatch();
  const { isLoading, error } = useAppSelector((state) => state.auth);
  const [showPassword, setShowPassword] = useState(false);

  const formik = useFormik({
    initialValues: {
      email: '',
      password: '',
    },
    validationSchema,
    onSubmit: async (values) => {
      await dispatch(login(values));
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
          Intelligent chat with text and audio analysis
        </p>
      </div>

      <div className="flex justify-center mb-6">
        <div className="inline-flex rounded-lg border border-gray-700 p-1 bg-gray-900">
          <button
            type="button"
            className="px-6 py-2 rounded-md bg-gradient-to-r from-purple-600 to-pink-500 text-white font-medium"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={onToggle}
            className="px-6 py-2 rounded-md text-gray-400 hover:text-white transition-colors"
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

        <Button
          type="submit"
          isLoading={isLoading}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white font-medium rounded-lg"
        >
          Sign In
        </Button>
      </form>

      <div className="mt-6 text-center">
        <button
          onClick={onToggle}
          className="text-purple-400 hover:text-purple-300 transition-colors"
        >
          Don't have an account? Sign up
        </button>
      </div>

      <div className="mt-8 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
        <p className="text-sm text-gray-400 mb-2">Demo credentials:</p>
        <div className="text-sm">
          <p className="text-gray-300">Email: demo@example.com</p>
          <p className="text-gray-300">Password: demo123</p>
        </div>
      </div>
    </div>
  );
};
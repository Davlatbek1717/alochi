import { LoginForm } from './_components/LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-indigo-600">A&apos;lochi</h1>
          <p className="text-gray-500 text-sm mt-1">Tizimga kirish</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}

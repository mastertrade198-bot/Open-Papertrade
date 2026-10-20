"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, CircleCheck, Mail, ArrowLeft, AtSign, Check, X as XIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const features = [
  "US$ 100 mil de capital virtual para começar",
  "Dados de mercado em tempo real",
  "Acompanhe o desempenho",
  "Não é necessário cartão de crédito",
];

export default function SignupPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Email verification state
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  const [usernameManuallyEdited, setUsernameManuallyEdited] = useState(false);
  const { signup, resendVerification } = useAuth();
  const router = useRouter();

  // Validate username format
  const validateUsername = useCallback((value: string) => {
    if (!value) {
      setUsernameError("");
      return;
    }
    if (value.length < 3) {
      setUsernameError("Use pelo menos 3 caracteres");
      return;
    }
    if (!/^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/.test(value)) {
      setUsernameError("Use apenas letras minúsculas, números e hífens");
      return;
    }
    setUsernameError("");
  }, []);

  // Auto-generate username from name if not manually edited
  useEffect(() => {
    if (usernameManuallyEdited) return;
    const name = `${firstName} ${lastName}`.trim();
    if (!name) {
      setUsername("");
      return;
    }
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    setUsername(slug);
    validateUsername(slug);
  }, [firstName, lastName, usernameManuallyEdited, validateUsername]);

  const handleUsernameChange = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setUsername(cleaned);
    setUsernameManuallyEdited(true);
    validateUsername(cleaned);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms) return;
    setIsLoading(true);
    setError("");
    try {
      const name = `${firstName} ${lastName}`.trim();
      if (cpf && !/^\d{11}$/.test(cpf)) { setError("CPF deve conter 11 dígitos"); setIsLoading(false); return; }
      const result = await signup(name, email, password, username || undefined, { cpf, dateOfBirth, phone });

      if (result.emailVerificationRequired) {
        setVerificationEmail(email);
        setVerificationSent(true);
      } else {
        router.push("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar conta");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    setResendMessage("");
    setError("");
    try {
      const message = await resendVerification(verificationEmail);
      setResendMessage(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao reenviar");
    } finally {
      setResendLoading(false);
    }
  };

  // Show verification sent screen
  if (verificationSent) {
    return (
      <div className="flex h-full w-full bg-[var(--bg-primary)]">
        {/* Left Panel - Branding */}
        <div className="hidden lg:flex flex-1 flex-col justify-between bg-[var(--bg-sidebar)] p-[60px]">
          <Link href="/" className="flex items-center gap-3.5 hover:opacity-80 transition-opacity">
            <img src="/logo.png" alt="Master Trade" width={40} height={40} />
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-lg tracking-[4px] text-[var(--text-primary)]">MASTER</span>
              <span className="font-mono text-lg font-bold tracking-[4px] text-[var(--accent-primary)]">TRADE</span>
            </div>
          </Link>

          <div className="flex flex-col gap-8">
            <h1 className="font-serif text-[56px] font-medium leading-[1.1] tracking-[-1px] text-[var(--text-primary)]">
              Falta pouco.
            </h1>
            <p className="text-lg text-[var(--text-muted)] leading-[1.6]">
              Só mais um passo para começar sua
              <br />
              jornada de negociação.
            </p>
          </div>

          <div />
        </div>

        {/* Right Panel - Verification Message */}
        <div className="flex flex-col items-center justify-center w-full lg:w-[520px] lg:min-w-[520px] px-8 py-10 lg:px-[80px]">
          <div className="flex flex-col items-center gap-6 w-full max-w-[360px] text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--accent-primary)]/10 flex items-center justify-center">
              <Mail size={32} className="text-[var(--accent-primary)]" />
            </div>

            <div className="flex flex-col gap-2">
              <h2 className="font-serif text-[28px] font-medium text-[var(--text-primary)]">
                Verifique seu e-mail
              </h2>
              <p className="text-[15px] text-[var(--text-muted)] leading-[1.6]">
                Enviamos um link de verificação para
              </p>
              <p className="text-[15px] font-semibold text-[var(--text-primary)]">
                {verificationEmail}
              </p>
            </div>

            <p className="text-sm text-[var(--text-muted)] leading-[1.6]">
              Clique no link recebido para verificar sua conta e começar a negociar.
              O link será aberto no navegador.
            </p>

            {/* Resend section */}
            <div className="flex flex-col items-center gap-3 w-full pt-4 border-t border-[var(--border-primary)]">
              <span className="text-sm text-[var(--text-muted)]">
                Não recebeu o e-mail?
              </span>
              <button
                onClick={handleResend}
                disabled={resendLoading}
                className="text-sm font-semibold text-[var(--accent-primary)] hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                {resendLoading ? "Enviando..." : "Reenviar e-mail de verificação"}
              </button>

              {resendMessage && (
                <p className="text-sm text-green-400">{resendMessage}</p>
              )}
              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}
            </div>

            {/* Voltar ao login */}
            <Link
              href="/login"
              className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mt-2"
            >
              <ArrowLeft size={16} />
              Voltar ao login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-[var(--bg-primary)]">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex flex-1 flex-col justify-between bg-[var(--bg-sidebar)] p-[60px]">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3.5 hover:opacity-80 transition-opacity">
          <img src="/logo.png" alt="Master Trade" width={40} height={40} />
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-lg tracking-[4px] text-[var(--text-primary)]">MASTER</span>
            <span className="font-mono text-lg font-bold tracking-[4px] text-[var(--accent-primary)]">TRADE</span>
          </div>
        </Link>

        {/* Center Content */}
        <div className="flex flex-col gap-8">
          <h1 className="font-serif text-[56px] font-medium leading-[1.1] tracking-[-1px] text-[var(--text-primary)]">
            Comece sua
            <br />
            Jornada de Negociação.
          </h1>
          <p className="text-lg text-[var(--text-muted)] leading-[1.6]">
            Desenvolva suas habilidades de negociação
            <br />
            com capital virtual, sem usar dinheiro real.
          </p>

          {/* Feature List */}
          <div className="flex flex-col gap-4">
            {features.map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <CircleCheck size={20} className="text-[var(--accent-primary)] shrink-0" />
                <span className="text-[15px] text-[var(--text-primary)]">
                  {feature}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div className="flex flex-col gap-4 rounded-xl border border-[var(--border-primary)] p-6">
          <p className="text-base italic text-[var(--text-primary)] leading-[1.5]">
            &ldquo;Lorem ipsum dolor sit amet, consectetur adipiscing elit.
            Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.&rdquo;
          </p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--border-muted)]" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                John Doe
              </span>
              <span className="text-[13px] text-[var(--text-muted)]">
                Trader, há 3 meses na plataforma
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Signup Form */}
      <div className="flex flex-col items-center justify-center w-full lg:w-[520px] lg:min-w-[520px] px-8 py-10 lg:px-[80px]">
        {/* Mobile Logo */}
        <div className="flex items-center gap-3.5 mb-10 lg:hidden">
          <img src="/logo.png" alt="Master Trade" width={40} height={40} />
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-lg tracking-[4px] text-[var(--text-primary)]">MASTER</span>
            <span className="font-mono text-lg font-bold tracking-[4px] text-[var(--accent-primary)]">TRADE</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-7 w-full max-w-[360px]">
          {/* Form Header */}
          <div className="flex flex-col items-center lg:items-start gap-2">
            <h2 className="font-serif text-[32px] font-medium text-[var(--text-primary)]">
              Crie sua conta
            </h2>
            <p className="text-[15px] text-[var(--text-muted)]">
              Comece em menos de 2 minutos
            </p>
          </div>

          {/* Form Fields */}
          <div className="flex flex-col gap-4">
            {/* Name Row */}
            <div className="flex gap-3">
              <div className="flex flex-col gap-2 flex-1">
                <label className="text-sm font-medium text-[var(--text-primary)]">
                  Nome
                </label>
                <input
                  type="text"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-muted)] bg-transparent px-3.5 py-3 text-[15px] text-[var(--text-primary)] placeholder-[var(--text-dim)] outline-none focus:border-[var(--accent-primary)] transition-colors"
                />
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <label className="text-sm font-medium text-[var(--text-primary)]">
                  Sobrenome
                </label>
                <input
                  type="text"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-muted)] bg-transparent px-3.5 py-3 text-[15px] text-[var(--text-primary)] placeholder-[var(--text-dim)] outline-none focus:border-[var(--accent-primary)] transition-colors"
                />
              </div>
            </div>

            {/* Username */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-[var(--text-primary)]">
                Nome de usuário
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-[var(--text-dim)]">@</span>
                <input
                  type="text"
                  placeholder="john-doe"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  maxLength={30}
                  className="w-full rounded-lg border border-[var(--border-muted)] bg-transparent pl-8 pr-3.5 py-3 text-[15px] text-[var(--text-primary)] placeholder-[var(--text-dim)] outline-none focus:border-[var(--accent-primary)] transition-colors"
                />
              </div>
              {usernameError ? (
                <span className="text-xs text-[var(--accent-red)]">{usernameError}</span>
              ) : username.length >= 3 ? (
                <span className="text-xs text-[var(--accent-green)]">Nome de usuário disponível</span>
              ) : (
                <span className="text-xs text-[var(--text-muted)]">De 3 a 30 caracteres: letras, números e hífens</span>
              )}
            </div>

            {/* Email */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-[var(--text-primary)]">
                E-mail
              </label>
              <input
                type="email"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-muted)] bg-transparent px-3.5 py-3 text-[15px] text-[var(--text-primary)] placeholder-[var(--text-dim)] outline-none focus:border-[var(--accent-primary)] transition-colors"
              />
            </div>

            {/* Dados pessoais */}
            <div className="flex flex-col gap-2">
              <label htmlFor="signup-cpf" className="text-sm font-medium text-[var(--text-primary)]">CPF</label>
              <input id="signup-cpf" type="text" inputMode="numeric" autoComplete="off" maxLength={11} placeholder="Somente números" value={cpf} onChange={(e) => setCpf(e.target.value.replace(/\D/g, "").slice(0, 11))} className="w-full rounded-lg border border-[var(--border-muted)] bg-transparent px-3.5 py-3 text-[15px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]" />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="signup-birth" className="text-sm font-medium text-[var(--text-primary)]">Data de nascimento</label>
              <input id="signup-birth" type="date" max={new Date().toISOString().slice(0, 10)} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="w-full rounded-lg border border-[var(--border-muted)] bg-transparent px-3.5 py-3 text-[15px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]" />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="signup-phone" className="text-sm font-medium text-[var(--text-primary)]">Telefone</label>
              <input id="signup-phone" type="tel" autoComplete="tel" maxLength={20} placeholder="(81) 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border border-[var(--border-muted)] bg-transparent px-3.5 py-3 text-[15px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]" />
            </div>
            {/* Password */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-[var(--text-primary)]">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Crie uma senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-muted)] bg-transparent px-3.5 py-3 pr-12 text-[15px] text-[var(--text-primary)] placeholder-[var(--text-dim)] outline-none focus:border-[var(--accent-primary)] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                </button>
              </div>
              <span className="text-xs text-[var(--text-muted)]">
                Use pelo menos 8 caracteres
              </span>
            </div>

            {/* Terms Checkbox */}
            <div className="flex items-start gap-2.5">
              <button
                type="button"
                onClick={() => setAgreedToTerms(!agreedToTerms)}
                className={`w-5 h-5 rounded shrink-0 mt-0.5 border transition-colors ${
                  agreedToTerms
                    ? "bg-[var(--accent-primary)] border-[var(--accent-primary)]"
                    : "border-[var(--border-muted)]"
                } flex items-center justify-center`}
              >
                {agreedToTerms && (
                  <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                    <path
                      d="M2 6L5 9L10 3"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
              <span className="text-[13px] text-[var(--text-secondary)] leading-[1.4]">
                Concordo com os{" "}
                <button type="button" className="text-[var(--accent-primary)] hover:opacity-80 transition-opacity">
                  Termos de Serviço
                </button>{" "}
                e{" "}
                <button type="button" className="text-[var(--accent-primary)] hover:opacity-80 transition-opacity">
                  Política de Privacidade
                </button>
              </span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Signup Button */}
          <button
            type="submit"
            disabled={isLoading || !agreedToTerms}
            className="w-full rounded-lg bg-[var(--accent-primary)] py-4 text-base font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Criando conta..." : "Criar conta"}
          </button>

          {/* Login Prompt */}
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-sm text-[var(--text-muted)]">
              Já tem uma conta?
            </span>
            <Link
              href="/login"
              className="text-sm font-semibold text-[var(--accent-primary)] hover:opacity-80 transition-opacity"
            >
              Entrar
            </Link>
          </div>

        </form>
      </div>
    </div>
  );
}

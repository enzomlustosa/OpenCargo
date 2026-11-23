import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, Plus, Save, UserCheck, UserPlus, X } from 'lucide-react';

const ROLES = ['Funcionário', 'Supervisor', 'Gerente', 'Administrador'];

const DOOR_LABELS = [
  { id: 1, label: 'Porta 01 — Estoque' },
  { id: 2, label: 'Porta 02 — Administração' },
  { id: 3, label: 'Porta 03 — Produção' },
  { id: 4, label: 'Porta 04 — Laboratório' },
];

const ROLE_DEFAULT_PERMISSIONS = {
  Funcionário: [true, false, true, false],
  Supervisor: [true, true, true, false],
  Gerente: [true, true, true, true],
  Administrador: [true, true, true, true],
};

export default function UserForm({
  editingUser = null,
  isSubmitting = false,
  onSubmitUser,
  onCancelEdit,
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [role, setRole] = useState('Funcionário');
  const [permissions, setPermissions] = useState([true, false, true, false]);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    setValidationError('');
    if (editingUser) {
      setName(editingUser.name || '');
      setCode(editingUser.code || '');
      setRole(editingUser.role || 'Funcionário');
      setPermissions(
        Array.isArray(editingUser.permissions) && editingUser.permissions.length === 4
          ? [...editingUser.permissions]
          : [false, false, false, false]
      );
    } else {
      setName('');
      setCode('');
      setRole('Funcionário');
      setPermissions([...ROLE_DEFAULT_PERMISSIONS['Funcionário']]);
    }
  }, [editingUser]);

  function handleRoleChange(newRole) {
    setRole(newRole);
    if (newRole === 'Administrador') {
      setPermissions([true, true, true, true]);
    } else if (!editingUser && ROLE_DEFAULT_PERMISSIONS[newRole]) {
      setPermissions([...ROLE_DEFAULT_PERMISSIONS[newRole]]);
    }
  }

  function handleTogglePermission(index) {
    if (role === 'Administrador') return;
    setPermissions((prev) => prev.map((val, idx) => (idx === index ? !val : val)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setValidationError('');

    const trimmedName = name.trim();
    const trimmedCode = code.trim();

    if (!trimmedName) {
      setValidationError('O nome do usuário é obrigatório.');
      return;
    }

    if (!/^\d{5}$/.test(trimmedCode)) {
      setValidationError('O código de acesso deve conter exatamente 5 dígitos numéricos.');
      return;
    }

    if (!ROLES.includes(role)) {
      setValidationError('Selecione um cargo válido.');
      return;
    }

    const finalPermissions =
      role === 'Administrador' ? [true, true, true, true] : [...permissions];

    const succeeded = await onSubmitUser({
      id: editingUser?.id,
      name: trimmedName,
      code: trimmedCode,
      role,
      permissions: finalPermissions,
    });

    if (succeeded && !editingUser) {
      setName('');
      setCode('');
      setRole('Funcionário');
      setPermissions([...ROLE_DEFAULT_PERMISSIONS['Funcionário']]);
    }
  }

  const isAdminSelected = role === 'Administrador';

  return (
    <div className="bg-white border border-neutral-200 rounded p-5">
      <div className="flex items-center justify-between border-b border-neutral-200 pb-3.5 mb-4">
        <div className="flex items-center gap-2">
          {editingUser ? (
            <UserCheck className="w-4 h-4 text-neutral-900" />
          ) : (
            <UserPlus className="w-4 h-4 text-neutral-900" />
          )}
          <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-900 m-0">
            {editingUser
              ? `Editar Usuário: ${editingUser.name} (ID #${editingUser.id})`
              : 'Cadastrar Novo Usuário'}
          </h3>
        </div>

        {editingUser && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 text-xs font-medium cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Cancelar edição
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Nome */}
          <div>
            <label
              htmlFor="user-form-name"
              className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
            >
              Nome completo
            </label>
            <input
              id="user-form-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Diego Rocha"
              disabled={isSubmitting}
              className="w-full px-3 py-2 rounded border border-neutral-300 text-sm text-neutral-900 focus:outline-none focus:border-neutral-900 box-border"
            />
          </div>

          {/* Código de acesso de 5 dígitos */}
          <div>
            <label
              htmlFor="user-form-code"
              className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
            >
              Código (5 dígitos)
            </label>
            <input
              id="user-form-code"
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="Ex: 45678"
              disabled={isSubmitting}
              className="w-full px-3 py-2 rounded border border-neutral-300 text-sm font-mono text-neutral-900 focus:outline-none focus:border-neutral-900 box-border"
            />
          </div>

          {/* Cargo */}
          <div>
            <label
              htmlFor="user-form-role"
              className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5"
            >
              Cargo
            </label>
            <select
              id="user-form-role"
              value={role}
              onChange={(e) => handleRoleChange(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-2 rounded border border-neutral-300 text-sm text-neutral-900 bg-white focus:outline-none focus:border-neutral-900 box-border"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Permissões por Porta */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-700">
              Permissões de Acesso por Porta
            </span>
            {isAdminSelected && (
              <span className="text-xs text-neutral-500">
                Administradores possuem acesso total às 4 portas por regra do firmware.
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {DOOR_LABELS.map((door, idx) => {
              const checked = isAdminSelected ? true : Boolean(permissions[idx]);
              return (
                <label
                  key={door.id}
                  className={`flex items-center gap-2.5 p-2.5 rounded border text-xs font-medium select-none transition-colors ${
                    checked
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'bg-neutral-50 text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                  } ${isAdminSelected ? 'opacity-85 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isSubmitting || isAdminSelected}
                    onChange={() => handleTogglePermission(idx)}
                    className="sr-only"
                  />
                  <span
                    className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                      checked
                        ? 'bg-white text-neutral-900 border-white'
                        : 'bg-white border-neutral-400'
                    }`}
                  >
                    {checked && <Check className="w-3 h-3 stroke-[3]" />}
                  </span>
                  <span>{door.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {validationError && (
          <div className="p-3 rounded border border-red-300 bg-red-50 text-red-900 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
            <span className="font-medium">{validationError}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200">
          {editingUser && (
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={isSubmitting}
              className="px-4 py-2 rounded border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100 text-xs font-medium cursor-pointer"
            >
              Cancelar
            </button>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded border-0 bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-300 disabled:text-neutral-500 text-xs font-semibold cursor-pointer"
          >
            {editingUser ? (
              <>
                <Save className="w-3.5 h-3.5" />
                {isSubmitting ? 'Salvando no ESP32...' : 'Salvar Alterações'}
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                {isSubmitting ? 'Cadastrando no ESP32...' : 'Cadastrar Usuário'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

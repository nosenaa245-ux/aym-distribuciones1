import React, { useState } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Search,
  KeyRound,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  X,
  Lock,
  Mail,
  Phone,
  Shield,
  Sparkles,
} from 'lucide-react';
import { AdminUser, AdminRole } from '../types';

interface AdminsAdminTabProps {
  admins: AdminUser[];
  currentAdmin: AdminUser | null;
  onSaveAdmin: (admin: AdminUser) => Promise<void>;
  onDeleteAdmin: (adminId: string) => Promise<void>;
}

export const AdminsAdminTab: React.FC<AdminsAdminTabProps> = ({
  admins,
  currentAdmin,
  onSaveAdmin,
  onDeleteAdmin,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | AdminRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal State for Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [formUsername, setFormUsername] = useState('');
  const [formName, setFormName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formConfirmPassword, setFormConfirmPassword] = useState('');
  const [formRole, setFormRole] = useState<AdminRole>('admin');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal State for Quick Change Password
  const [passwordModalAdmin, setPasswordModalAdmin] = useState<AdminUser | null>(null);
  const [quickNewPassword, setQuickNewPassword] = useState('');
  const [quickConfirmPassword, setQuickConfirmPassword] = useState('');
  const [showQuickPass, setShowQuickPass] = useState(false);
  const [passwordModalError, setPasswordModalError] = useState<string | null>(null);

  // Delete Confirm Modal
  const [deleteConfirmAdmin, setDeleteConfirmAdmin] = useState<AdminUser | null>(null);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setActionNotice({ type, text });
    setTimeout(() => {
      setActionNotice(null);
    }, 4000);
  };

  const handleOpenCreateModal = () => {
    setEditingAdmin(null);
    setFormUsername('');
    setFormName('');
    setFormPassword('');
    setFormConfirmPassword('');
    setFormRole('admin');
    setFormStatus('active');
    setFormEmail('');
    setFormPhone('');
    setFormError(null);
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (admin: AdminUser) => {
    setEditingAdmin(admin);
    setFormUsername(admin.username);
    setFormName(admin.name);
    setFormPassword('');
    setFormConfirmPassword('');
    setFormRole(admin.role);
    setFormStatus(admin.status);
    setFormEmail(admin.email || '');
    setFormPhone(admin.phone || '');
    setFormError(null);
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleOpenPasswordModal = (admin: AdminUser) => {
    setPasswordModalAdmin(admin);
    setQuickNewPassword('');
    setQuickConfirmPassword('');
    setShowQuickPass(false);
    setPasswordModalError(null);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanUser = formUsername.trim().toLowerCase();
    const cleanName = formName.trim();

    if (!cleanUser) {
      setFormError('El nombre de usuario es obligatorio.');
      return;
    }

    if (!cleanName) {
      setFormError('El nombre o descripción del administrador es obligatorio.');
      return;
    }

    // Check duplicate username if creating or changing username
    const isDuplicate = admins.some(
      (a) => a.username.toLowerCase() === cleanUser && a.id !== editingAdmin?.id
    );
    if (isDuplicate) {
      setFormError(`El usuario "${cleanUser}" ya existe. Por favor elija otro nombre de usuario.`);
      return;
    }

    // Password validation for new admin
    if (!editingAdmin) {
      if (!formPassword) {
        setFormError('La contraseña es requerida para un nuevo administrador.');
        return;
      }
      if (formPassword.length < 4) {
        setFormError('La contraseña debe contener al menos 4 caracteres.');
        return;
      }
      if (formPassword !== formConfirmPassword) {
        setFormError('Las contraseñas no coinciden.');
        return;
      }
    } else {
      // If editing and password was entered
      if (formPassword) {
        if (formPassword.length < 4) {
          setFormError('La nueva contraseña debe tener al menos 4 caracteres.');
          return;
        }
        if (formPassword !== formConfirmPassword) {
          setFormError('Las contraseñas no coinciden.');
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const adminData: AdminUser = {
        id: editingAdmin ? editingAdmin.id : `admin-${cleanUser}-${Date.now().toString(36)}`,
        username: cleanUser,
        name: cleanName,
        password: formPassword ? formPassword : editingAdmin ? editingAdmin.password : 'admin123',
        role: formRole,
        status: formStatus,
        email: formEmail.trim() || undefined,
        phone: formPhone.trim() || undefined,
        createdAt: editingAdmin ? editingAdmin.createdAt : new Date().toISOString(),
        lastLoginAt: editingAdmin ? editingAdmin.lastLoginAt : undefined,
      };

      await onSaveAdmin(adminData);
      setIsModalOpen(false);
      showNotification(
        editingAdmin
          ? `Administrador "${cleanName}" (@${cleanUser}) actualizado exitosamente.`
          : `¡Administrador "${cleanName}" (@${cleanUser}) creado exitosamente!`
      );
    } catch (err: any) {
      setFormError(err.message || 'Error al guardar el administrador.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveQuickPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalAdmin) return;

    if (quickNewPassword.length < 4) {
      setPasswordModalError('La contraseña debe tener al menos 4 caracteres.');
      return;
    }
    if (quickNewPassword !== quickConfirmPassword) {
      setPasswordModalError('Las contraseñas no coinciden.');
      return;
    }

    try {
      await onSaveAdmin({
        ...passwordModalAdmin,
        password: quickNewPassword,
      });
      setPasswordModalAdmin(null);
      showNotification(`Clave de acceso para @${passwordModalAdmin.username} actualizada con éxito.`);
    } catch (err: any) {
      setPasswordModalError(err.message || 'Error al actualizar la contraseña.');
    }
  };

  const handleToggleStatus = async (admin: AdminUser) => {
    if (admin.id === currentAdmin?.id) {
      showNotification('No puedes desactivar tu propia cuenta activa actual.', 'error');
      return;
    }

    // Check if it's the only active superadmin
    if (admin.role === 'superadmin' && admin.status === 'active') {
      const activeSuperAdmins = admins.filter((a) => a.role === 'superadmin' && a.status === 'active');
      if (activeSuperAdmins.length <= 1) {
        showNotification('No puedes desactivar el único Super Administrador activo del sistema.', 'error');
        return;
      }
    }

    const nextStatus: 'active' | 'inactive' = admin.status === 'active' ? 'inactive' : 'active';
    try {
      await onSaveAdmin({
        ...admin,
        status: nextStatus,
      });
      showNotification(
        `Administrador @${admin.username} ${nextStatus === 'active' ? 'activado' : 'desactivado'}.`
      );
    } catch (err: any) {
      showNotification('Error al cambiar el estado del administrador.', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmAdmin) return;

    if (deleteConfirmAdmin.id === currentAdmin?.id) {
      showNotification('No puedes eliminar tu propia cuenta en sesión.', 'error');
      setDeleteConfirmAdmin(null);
      return;
    }

    // Safeguard: Do not allow deleting the last superadmin
    if (deleteConfirmAdmin.role === 'superadmin') {
      const superAdmins = admins.filter((a) => a.role === 'superadmin');
      if (superAdmins.length <= 1) {
        showNotification('No puedes eliminar el único Super Administrador del sistema.', 'error');
        setDeleteConfirmAdmin(null);
        return;
      }
    }

    try {
      await onDeleteAdmin(deleteConfirmAdmin.id);
      showNotification(`Administrador @${deleteConfirmAdmin.username} eliminado correctamente.`);
    } catch (err: any) {
      showNotification('Error al eliminar el administrador.', 'error');
    } finally {
      setDeleteConfirmAdmin(null);
    }
  };

  // Filter admins
  const filteredAdmins = admins.filter((admin) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      admin.username.toLowerCase().includes(q) ||
      admin.name.toLowerCase().includes(q) ||
      (admin.email && admin.email.toLowerCase().includes(q)) ||
      (admin.phone && admin.phone.includes(q));

    const matchesRole = roleFilter === 'all' || admin.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || admin.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleBadge = (role: AdminRole) => {
    switch (role) {
      case 'superadmin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">
            <Sparkles className="w-3 h-3 text-amber-600" />
            Super Administrador
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <ShieldCheck className="w-3 h-3 text-blue-600" />
            Administrador
          </span>
        );
      case 'editor':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Shield className="w-3 h-3 text-emerald-600" />
            Editor de Catálogo
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Notification Toast */}
      {actionNotice && (
        <div
          className={`p-3 rounded-xl flex items-center gap-2 text-xs font-semibold shadow-xs animate-in fade-in ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {actionNotice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          )}
          <span>{actionNotice.text}</span>
        </div>
      )}

      {/* Header Banner & Stats */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-700/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Gestión de Administradores
              </h2>
              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full text-[10.5px] font-bold">
                {admins.length} {admins.length === 1 ? 'Usuario' : 'Usuarios'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Crea múltiples cuentas de administradores y editores para acceder al panel con claves individuales.
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Crear Nuevo Administrador</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por usuario, nombre, teléfono..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-gray-200 rounded-lg text-xs text-gray-800 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            aria-label="Filtrar por rol de administrador"
            className="px-2.5 py-1.5 bg-slate-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
          >
            <option value="all">Todos los roles ({admins.length})</option>
            <option value="superadmin">Super Administrador</option>
            <option value="admin">Administrador</option>
            <option value="editor">Editor de Catálogo</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            aria-label="Filtrar por estado de administrador"
            className="px-2.5 py-1.5 bg-slate-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Solo Activos</option>
            <option value="inactive">Solo Inactivos</option>
          </select>
        </div>
      </div>

      {/* Administrators Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredAdmins.map((admin) => {
          const isMe = admin.id === currentAdmin?.id;
          const initials = admin.name
            .split(' ')
            .filter(Boolean)
            .map((w) => w[0])
            .slice(0, 2)
            .join('')
            .toUpperCase() || admin.username.slice(0, 2).toUpperCase();

          return (
            <div
              key={admin.id}
              className={`bg-white rounded-xl border p-4 shadow-2xs transition-all flex flex-col justify-between ${
                admin.status === 'active'
                  ? 'border-gray-200 hover:border-blue-300'
                  : 'border-slate-200 bg-slate-50/70 opacity-80'
              }`}
            >
              <div>
                {/* Top User Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm tracking-wider shadow-2xs ${
                        admin.role === 'superadmin'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : admin.role === 'admin'
                          ? 'bg-blue-100 text-blue-900 border border-blue-300'
                          : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      }`}
                    >
                      {initials}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-extrabold text-sm text-slate-900 leading-snug">
                          {admin.name}
                        </h3>
                        {isMe && (
                          <span className="px-1.5 py-0.2 text-[9.5px] font-black bg-blue-600 text-white rounded-md">
                            TÚ
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-mono font-bold text-slate-500">
                        @{admin.username}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleStatus(admin)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                      admin.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-300'
                    }`}
                    title={
                      admin.status === 'active'
                        ? 'Clic para desactivar acceso'
                        : 'Clic para reactivar acceso'
                    }
                  >
                    {admin.status === 'active' ? (
                      <>
                        <UserCheck className="w-3 h-3 text-emerald-600" />
                        <span>Activo</span>
                      </>
                    ) : (
                      <>
                        <UserX className="w-3 h-3 text-gray-500" />
                        <span>Inactivo</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Role Badge */}
                <div className="mb-3 flex items-center justify-between">
                  {getRoleBadge(admin.role)}
                  <span className="text-[10px] text-gray-400 font-mono">
                    ID: {admin.id.slice(0, 10)}
                  </span>
                </div>

                {/* Contact & Last Login Info */}
                <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100 mb-3">
                  {admin.email && (
                    <div className="flex items-center gap-1.5 text-[11px] truncate">
                      <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{admin.email}</span>
                    </div>
                  )}
                  {admin.phone && (
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span>{admin.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-[10.5px] text-gray-500">
                    <Clock className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <span>
                      Último acceso:{' '}
                      <strong className="text-slate-700">
                        {admin.lastLoginAt
                          ? new Date(admin.lastLoginAt).toLocaleDateString('es-CO', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Nunca'}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleOpenPasswordModal(admin)}
                  className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  title="Cambiar contraseña de este administrador"
                >
                  <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                  <span>Clave</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenEditModal(admin)}
                  className="flex-1 py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  title="Editar datos del administrador"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteConfirmAdmin(admin)}
                  disabled={isMe}
                  className={`p-1.5 rounded-lg text-[11px] transition-colors ${
                    isMe
                      ? 'text-gray-300 bg-gray-50 cursor-not-allowed'
                      : 'text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer'
                  }`}
                  title={
                    isMe
                      ? 'No puedes eliminar tu propio usuario en sesión'
                      : 'Eliminar este administrador'
                  }
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {filteredAdmins.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white rounded-xl border border-dashed border-gray-300 p-6">
            <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-gray-700">No se encontraron administradores</h3>
            <p className="text-xs text-gray-500 mt-1">
              Prueba cambiando los filtros de búsqueda o crea un nuevo administrador.
            </p>
          </div>
        )}
      </div>

      {/* CREATE / EDIT ADMIN MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-gray-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
                  {editingAdmin ? <Edit2 className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    {editingAdmin ? 'Editar Administrador' : 'Crear Nuevo Administrador'}
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    {editingAdmin
                      ? `Modificando los datos de @${editingAdmin.username}`
                      : 'Agrega un nuevo usuario con acceso al panel administrativo'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs font-medium rounded-xl mb-4 flex items-center gap-2 border border-red-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveForm} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Username */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Usuario de Acceso (@login) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formUsername}
                    onChange={(e) =>
                      setFormUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))
                    }
                    placeholder="ej: supervisor, juanperez"
                    className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-lg font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    En minúsculas y sin espacios
                  </span>
                </div>

                {/* Full Name */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nombre o Cargo Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="ej: Juan Pérez (Ventas)"
                    className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-lg text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Nombre visible en el encabezado
                  </span>
                </div>
              </div>

              {/* Role & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Rol / Permisos *</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as AdminRole)}
                    className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-lg text-slate-900 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  >
                    <option value="superadmin">Super Administrador (Total)</option>
                    <option value="admin">Administrador (Catálogo, Pedidos, Clientes)</option>
                    <option value="editor">Editor (Solo productos y stock)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Estado de Acceso</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-lg text-slate-900 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  >
                    <option value="active">Activo (Puede iniciar sesión)</option>
                    <option value="inactive">Inactivo (Bloqueado)</option>
                  </select>
                </div>
              </div>

              {/* Password Fields */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-blue-600" />
                    {editingAdmin
                      ? 'Cambiar Contraseña (Dejar vacío para conservar actual)'
                      : 'Contraseña de Acceso *'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-[11px] font-medium cursor-pointer"
                  >
                    {showPassword ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Ocultar</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required={!editingAdmin}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder={editingAdmin ? 'Nueva clave opcional...' : 'Clave de acceso...'}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-mono"
                    />
                  </div>
                  <div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required={Boolean(formPassword)}
                      value={formConfirmPassword}
                      onChange={(e) => setFormConfirmPassword(e.target.value)}
                      placeholder="Confirmar contraseña..."
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Optional Contact Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">
                    Correo Electrónico (Opcional)
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="usuario@empresa.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">
                    Teléfono / WhatsApp (Opcional)
                  </label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="3113986110"
                    className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  {isSubmitting
                    ? 'Guardando...'
                    : editingAdmin
                    ? 'Actualizar Administrador'
                    : 'Crear Administrador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK CHANGE PASSWORD MODAL */}
      {passwordModalAdmin && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Cambiar Contraseña para @{passwordModalAdmin.username}
                  </h3>
                  <p className="text-[11px] text-gray-500">{passwordModalAdmin.name}</p>
                </div>
              </div>
              <button
                onClick={() => setPasswordModalAdmin(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {passwordModalError && (
              <div className="p-2.5 bg-red-50 text-red-700 text-xs font-medium rounded-lg mb-3 flex items-center gap-2 border border-red-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{passwordModalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveQuickPassword} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nueva Contraseña</label>
                <input
                  type={showQuickPass ? 'text' : 'password'}
                  required
                  value={quickNewPassword}
                  onChange={(e) => setQuickNewPassword(e.target.value)}
                  placeholder="Mínimo 4 caracteres..."
                  className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-lg text-slate-900 font-mono focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Confirmar Contraseña</label>
                <input
                  type={showQuickPass ? 'text' : 'password'}
                  required
                  value={quickConfirmPassword}
                  onChange={(e) => setQuickConfirmPassword(e.target.value)}
                  placeholder="Repite la nueva contraseña..."
                  className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-lg text-slate-900 font-mono focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setShowQuickPass(!showQuickPass)}
                  className="text-slate-500 hover:text-slate-700 flex items-center gap-1 text-[11px] font-medium cursor-pointer"
                >
                  {showQuickPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showQuickPass ? 'Ocultar' : 'Ver contraseñas'}</span>
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPasswordModalAdmin(null)}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm"
                  >
                    Guardar Clave
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmAdmin && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-200 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 mx-auto flex items-center justify-center mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-sm text-slate-900 mb-1">
              ¿Eliminar Administrador @{deleteConfirmAdmin.username}?
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Esta acción revocará el acceso de <strong>{deleteConfirmAdmin.name}</strong> al panel de control de forma permanente.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmAdmin(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-sm"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { Member } from '../../types';
import { X, User, Phone, Shield, Trash2, Check } from 'lucide-react';

interface MemberFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberToEdit?: Member | null;
}

const AVATAR_COLORS = [
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#14b8a6', // Teal
  '#6366f1', // Indigo
  '#f43f5e', // Rose
  '#84cc16', // Lime
];

export const MemberFormModal: React.FC<MemberFormModalProps> = ({
  isOpen,
  onClose,
  memberToEdit,
}) => {
  const { addMember, updateMember, deleteMember } = useFinance();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('Core Member');
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [errorMsg, setErrorMsg] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (memberToEdit) {
        setName(memberToEdit.name);
        setPhone(memberToEdit.phone || '');
        setRole(memberToEdit.role || 'Core Member');
        setAvatarColor(memberToEdit.avatarColor || AVATAR_COLORS[0]);
      } else {
        setName('');
        setPhone('');
        setRole('Core Member');
        setAvatarColor(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);
      }
      setErrorMsg('');
      setShowDeleteConfirm(false);
    }
  }, [isOpen, memberToEdit]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (memberToEdit) {
      updateMember(memberToEdit.id, {
        name: name.trim(),
        phone: phone.trim(),
        role: role.trim(),
        avatarColor,
      });
    } else {
      addMember({
        name: name.trim(),
        phone: phone.trim(),
        role: role.trim(),
        avatarColor,
      });
    }

    onClose();
  };

  const handleDelete = () => {
    if (memberToEdit) {
      const res = deleteMember(memberToEdit.id);
      if (!res.success) {
        setErrorMsg(res.message || 'Cannot delete this member.');
      } else {
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0D1527] border border-slate-800/90 rounded-t-3xl sm:rounded-3xl w-full max-w-md overflow-hidden shadow-2xl text-white max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800/80 shrink-0 bg-[#0F182C]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-950/80 border border-blue-800/60 text-blue-400 flex items-center justify-center font-bold shadow-xs">
              <User className="w-5 h-5 stroke-[2.2px]" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white leading-tight">
                {memberToEdit ? 'Edit Member Profile' : 'Add Tm ISHAL Member'}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Pre-saved community member roster
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4.5 overflow-y-auto flex-1 bg-[#0D1527]">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Member Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Full Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Salman Faris, Rashid K."
              className="w-full px-4 py-3 bg-[#111A2E] border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-[#15223C] focus:ring-4 focus:ring-blue-500/10 transition-all font-semibold"
              required
            />
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Phone / WhatsApp (Optional)
            </label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98471 23456"
                className="w-full pl-10 pr-4 py-3 bg-[#111A2E] border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-[#15223C] focus:ring-4 focus:ring-blue-500/10 transition-all font-mono-num font-medium"
              />
            </div>
          </div>

          {/* Role / Tag */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Role / Designation in Tm ISHAL
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-3 bg-[#111A2E] border border-slate-800 rounded-2xl text-sm text-white focus:outline-none focus:border-blue-500 focus:bg-[#15223C] focus:ring-4 focus:ring-blue-500/10 transition-all font-semibold"
            >
              <option value="Core Member">Core Member</option>
              <option value="Coordinator">Coordinator</option>
              <option value="Treasurer">Treasurer</option>
              <option value="Organizer">Organizer</option>
              <option value="Guest / Associate">Guest / Associate</option>
            </select>
          </div>

          {/* Avatar Color Picker */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Badge Color Accent
            </label>
            <div className="flex flex-wrap gap-2.5 pt-1">
              {AVATAR_COLORS.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setAvatarColor(col)}
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all duration-150 shadow-xs ${
                    avatarColor === col ? 'ring-3 ring-offset-2 ring-offset-[#0D1527] ring-blue-500 scale-105' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: col }}
                >
                  {avatarColor === col && <Check className="w-4 h-4 text-white stroke-[3px]" />}
                </button>
              ))}
            </div>
          </div>

          {/* Delete Option if editing */}
          {memberToEdit && (
            <div className="pt-2 border-t border-slate-800">
              {showDeleteConfirm ? (
                <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800/80 space-y-2.5">
                  <p className="text-xs text-rose-300 font-bold">
                    Remove "{memberToEdit.name}" from Tm ISHAL member list?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-2 bg-slate-800 border border-slate-700 text-xs text-slate-300 rounded-xl font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white rounded-xl shadow-xs"
                    >
                      Yes, Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-950/40 rounded-2xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove Member
                </button>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-2xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-2xl shadow-md shadow-blue-600/30 transition-all active:scale-98"
            >
              {memberToEdit ? 'Save Changes' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

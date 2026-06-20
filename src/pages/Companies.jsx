import React, { useMemo, useState } from 'react';
import { firebase } from '@/api/firebaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/lib/companyContext';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { logAction } from '@/lib/auditLogger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Building2, Plus, Users, Loader2, Settings } from 'lucide-react';
import { motion } from 'framer-motion';

const industries = ['tecnología', 'manufactura', 'servicios', 'comercio', 'construcción', 'salud', 'educación', 'finanzas', 'otro'];

export default function Companies() {
  const { companies, reloadCompanies, switchCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showMembers, setShowMembers] = useState(null);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('invitado');
  const [formData, setFormData] = useState({ name: '', rfc: '', industry: 'tecnología', address: '', phone: '', email: '', fiscalRegime: '' });

  const { data: allMembers = [] } = useQuery({
    queryKey: ['members', companies.map((company) => company.id).join('|')],
    queryFn: async () => {
      const memberLists = await Promise.all(
        companies.map((company) => firebase.entities.CompanyMember.filter({ companyId: company.id, status: 'active' }).catch(() => [])),
      );
      return memberLists.flat();
    },
    enabled: companies.length > 0,
  });

  const membersByCompany = useMemo(() => {
    return allMembers.reduce((accumulator, member) => {
      if (!member?.companyId || member.status !== 'active') return accumulator;
      if (!accumulator[member.companyId]) {
        accumulator[member.companyId] = [];
      }
      accumulator[member.companyId].push(member);
      return accumulator;
    }, {});
  }, [allMembers]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const userUid = user?.uid || user?.id;
      if (!userUid) throw new Error('Usuario sin UID válido.');

      const company = await firebase.entities.Company.create(data);
      await firebase.entities.CompanyMember.create({
        companyId: company.id,
        userUid,
        userEmail: user.email,
        userName: user.fullName || '',
        role: 'director',
        status: 'active'
      });
      await logAction({
        companyId: company.id, userEmail: user.email, userName: user.fullName,
        action: 'company_create', entityType: 'Company', entityId: company.id, details: data.name
      });
      return company;
    },
    onSuccess: async (company) => {
      await reloadCompanies();
      switchCompany(company);
      setShowCreate(false);
      setFormData({ name: '', rfc: '', industry: 'tecnología', address: '', phone: '', email: '', fiscalRegime: '' });
      toast({ title: 'Empresa creada' });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async () => {
      await firebase.entities.CompanyMember.create({
        companyId: showMembers.id,
        userEmail: newMemberEmail,
        role: newMemberRole,
        status: 'active'
      });
      await logAction({
        companyId: showMembers.id, userEmail: user.email, userName: user.fullName,
        action: 'member_add', entityType: 'CompanyMember', details: `${newMemberEmail} como ${newMemberRole}`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setNewMemberEmail('');
      toast({ title: 'Miembro agregado' });
    },
  });

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Empresas"
        description="Gestiona tus empresas y equipos de trabajo."
        actions={
          <Button onClick={() => setShowCreate(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" /> Nueva Empresa
          </Button>
        }
      />

      {companies.length === 0 ? (
        <EmptyState icon={Building2} title="Sin empresas" description="Crea tu primera empresa para comenzar."
          action={<Button onClick={() => setShowCreate(true)} className="bg-primary text-primary-foreground">Crear Empresa</Button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map(company => {
            const members = membersByCompany[company.id] ?? [];
            return (
              <motion.div key={company.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => switchCompany(company)}>
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 rounded-lg bg-primary/10">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <Badge variant="outline" className="text-xs border-emerald-500/20 text-emerald-400">{company.status}</Badge>
                </div>
                <h3 className="font-semibold text-foreground text-lg">{company.name}</h3>
                {company.rfc && <p className="text-xs text-muted-foreground mt-1">RFC: {company.rfc}</p>}
                {company.industry && <Badge variant="outline" className="mt-2 text-xs border-border">{company.industry}</Badge>}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="w-3.5 h-3.5" /> {members.length} miembros
                  </div>
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setShowMembers(company); }}
                    className="text-muted-foreground hover:text-foreground">
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Company Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">Nueva Empresa</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <Label>Nombre *</Label>
              <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Nombre de la empresa" className="bg-secondary border-border" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>RFC</Label>
                <Input value={formData.rfc} onChange={e => setFormData({ ...formData, rfc: e.target.value })} placeholder="RFC" className="bg-secondary border-border" />
              </div>
              <div>
                <Label>Industria</Label>
                <Select value={formData.industry} onValueChange={v => setFormData({ ...formData, industry: v })}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {industries.map(i => <SelectItem key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Dirección Fiscal</Label>
              <Input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Dirección" className="bg-secondary border-border" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Teléfono</Label>
                <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="bg-secondary border-border" />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="bg-secondary border-border" />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)} className="border-border">Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending} className="bg-primary text-primary-foreground">
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Crear
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Members Dialog */}
      <Dialog open={!!showMembers} onOpenChange={() => setShowMembers(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">Equipo — {showMembers?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              {(membersByCompany[showMembers?.id] ?? []).map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                  <div>
                    <p className="text-sm font-medium">{m.userName || m.userEmail}</p>
                    <p className="text-xs text-muted-foreground">{m.userEmail}</p>
                  </div>
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary">{m.role}</Badge>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium mb-2">Agregar miembro</p>
              <div className="flex gap-2">
                <Input value={newMemberEmail} onChange={e => setNewMemberEmail(e.target.value)} placeholder="email@ejemplo.com" className="bg-secondary border-border flex-1" />
                <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                  <SelectTrigger className="w-36 bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="director">Director</SelectItem>
                    <SelectItem value="cliente_premium">Premium</SelectItem>
                    <SelectItem value="invitado">Invitado</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => addMemberMutation.mutate()} disabled={!newMemberEmail || addMemberMutation.isPending} className="bg-primary text-primary-foreground">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

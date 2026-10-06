import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const CommerceContext = createContext(null);

export function CommerceProvider({ children }) {
  const { user } = useAuth();
  const [commerces, setCommerces] = useState([]);
  const [currentCommerceId, setCurrentCommerceId] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Pre-onboarding (no organization yet) there's nothing to load.
      if (!user?.organization_id) { setLoading(false); return; }
      setLoading(true);
      try {
        let list = await base44.entities.Commerce.list().catch(() => []);
        if (list.length === 0) {
          const def = await base44.entities.Commerce.create({
            name: 'Comercio Principal',
            owner_id: user.id,
            is_active: true,
          }).catch(() => null);
          if (def) list = [def];
        }
        setCommerces(list);
        if (list.length === 1) setCurrentCommerceId(list[0].id);
        else setCurrentCommerceId('all');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const currentCommerce = commerces.find(c => c.id === currentCommerceId) || null;

  const filterByCommerce = useMemo(() => (records) => {
    if (!currentCommerceId || currentCommerceId === 'all') return records;
    return (records || []).filter(r => !r.commerce_id || r.commerce_id === currentCommerceId);
  }, [currentCommerceId]);

  const value = {
    commerces,
    currentCommerceId,
    setCurrentCommerceId,
    currentCommerce,
    filterByCommerce,
    loading,
  };

  return <CommerceContext.Provider value={value}>{children}</CommerceContext.Provider>;
}

export function useCommerce() {
  const ctx = useContext(CommerceContext);
  if (!ctx) throw new Error('useCommerce must be used within CommerceProvider');
  return ctx;
}

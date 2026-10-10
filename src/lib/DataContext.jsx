import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { user } = useAuth();
  const [config, setConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(true);

  const loadConfig = useCallback(async () => {
    try {
      setConfigLoading(true);
      const list = await base44.entities.AppConfig.list();
      if (list && list.length > 0) {
        setConfig(list[0]);
        return list[0];
      }
      // create default config
      try {
        const created = await base44.entities.AppConfig.create({
          company_name: 'Conectado Flow',
          currency: 'ARS',
          currency_symbol: '$',
          tax_rate: 21,
          mode: 'Independiente',
          onboarded: false,
          primary_color: '#465BE8',
        });
        setConfig(created);
        return created;
      } catch (createErr) {
        // Otra llamada a loadConfig() en paralelo (ej. dos componentes
        // montando a la vez) puede haber creado el config primero — la
        // restricción única de app_config.organization_id hace fallar esta
        // segunda inserción en vez de duplicarla. En ese caso el config ya
        // existe: lo volvemos a buscar en vez de tratar esto como un error.
        if (createErr?.code === '23505') {
          const retryList = await base44.entities.AppConfig.list();
          if (retryList && retryList.length > 0) {
            setConfig(retryList[0]);
            return retryList[0];
          }
        }
        throw createErr;
      }
    } catch (e) {
      console.error('loadConfig error', e);
      return null;
    } finally {
      setConfigLoading(false);
    }
  }, []);

  const updateConfig = useCallback(async (id, data) => {
    const updated = await base44.entities.AppConfig.update(id, data);
    setConfig(updated);
    return updated;
  }, []);

  useEffect(() => {
    // Pre-onboarding (no organization yet) there is nothing to load — AppConfig
    // RLS requires organization_id, so loadConfig() would just fail silently.
    if (user?.organization_id) loadConfig();
    else setConfigLoading(false);
  }, [user, loadConfig]);

  return (
    <DataContext.Provider value={{ config, configLoading, loadConfig, updateConfig, user }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}

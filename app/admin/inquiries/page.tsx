'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getInquiries, markInquiryRead, Inquiry } from '@/lib/services/public.service';
import { FiMail, FiPhone, FiCheckCircle, FiRefreshCw, FiInbox } from 'react-icons/fi';

export default function InquiriesPage() {
  const { user } = useAuth();

  const [inquiries,    setInquiries]    = useState<Inquiry[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [activeTab,    setActiveTab]    = useState<'unread' | 'all'>('unread');

  const fetchData = async () => {
    const data = await getInquiries();
    setInquiries(data);
  };

  useEffect(() => {
    if (!user?.email) return;
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [user?.email]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleMarkRead = async (id: number) => {
    await markInquiryRead(id);
    setInquiries(prev =>
      prev.map(inq => inq.id === id ? { ...inq, readAt: new Date().toISOString() } : inq)
    );
  };

  const handleMarkAllRead = async () => {
    const unread = inquiries.filter(i => !i.readAt);
    await Promise.all(unread.map(i => markInquiryRead(i.id)));
    setInquiries(prev => prev.map(i => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })));
  };

  if (!user) return null;

  const unread   = inquiries.filter(i => !i.readAt);
  const filtered = activeTab === 'unread' ? unread : inquiries;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">Inquiries</h1>
            {unread.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[0.6rem] font-black animate-pulse">
                {unread.length} new
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            {inquiries.length} total · {unread.length} unread
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {unread.length > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 bg-emerald-50 border border-emerald-200 rounded font-black text-sm text-emerald-700 hover:bg-emerald-100 transition shadow-sm active:scale-95"
            >
              <FiCheckCircle className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Mark All Read</span>
            </button>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 bg-white border border-slate-200 rounded font-black text-sm text-slate-600 hover:bg-slate-50 transition shadow-sm active:scale-95 disabled:opacity-60"
          >
            <FiRefreshCw className={`w-4 h-4 shrink-0 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {(['unread', 'all'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === tab
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab === 'unread' ? `Unread (${unread.length})` : `All (${inquiries.length})`}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-6 py-5 animate-pulse flex gap-4">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-200 mt-1 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-200 rounded w-48" />
                  <div className="h-2.5 bg-slate-100 rounded w-64" />
                  <div className="h-2 bg-slate-100 rounded w-full max-w-xs" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <FiInbox className="w-10 h-10 text-slate-200" />
            <p className="text-sm font-black text-slate-400">
              {activeTab === 'unread' ? 'No unread inquiries' : 'No inquiries yet'}
            </p>
            {activeTab === 'unread' && inquiries.length > 0 && (
              <button onClick={() => setActiveTab('all')} className="text-xs text-emerald-600 font-bold underline underline-offset-2">
                View all {inquiries.length}
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(inq => (
              <div
                key={inq.id}
                className={`px-4 lg:px-6 py-4 flex flex-col sm:flex-row sm:items-start gap-3 transition-colors ${
                  !inq.readAt ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-slate-50/60'
                }`}
              >
                {/* Status dot */}
                <div className="shrink-0 pt-1.5">
                  <span className={`block w-2.5 h-2.5 rounded-full ${!inq.readAt ? 'bg-rose-500' : 'bg-slate-200'}`} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="text-sm font-black text-slate-800">{inq.institutionName}</p>
                    <p className="text-xs text-slate-500 font-semibold">{inq.contactName}</p>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1">
                    <a
                      href={`mailto:${inq.email}`}
                      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-600 transition-colors"
                    >
                      <FiMail className="w-3 h-3 shrink-0" />
                      {inq.email}
                    </a>
                    {inq.phone && (
                      <a
                        href={`tel:${inq.phone}`}
                        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-600 transition-colors"
                      >
                        <FiPhone className="w-3 h-3 shrink-0" />
                        {inq.phone}
                      </a>
                    )}
                  </div>
                  {inq.message && (
                    <p className="text-xs text-slate-500 italic leading-relaxed">{inq.message}</p>
                  )}
                  <p className="text-[0.6rem] text-slate-300 font-medium">
                    {new Date(inq.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    {inq.readAt && (
                      <span className="ml-2 text-emerald-400">
                        · Read {new Date(inq.readAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    )}
                  </p>
                </div>

                {/* Action */}
                {!inq.readAt && (
                  <button
                    onClick={() => handleMarkRead(inq.id)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-black text-emerald-600 bg-emerald-50 hover:bg-emerald-500 hover:text-white border border-emerald-100 transition self-start"
                  >
                    <FiCheckCircle className="w-3 h-3" /> Mark Read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

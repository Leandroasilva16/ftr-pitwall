import React, { useState, useEffect, useMemo, useRef } from 'react';
import LZString from 'lz-string';
import {
  Flag,
  Clock,
  Fuel,
  Zap,
  Gauge,
  Calendar,
  RotateCcw,
  Copy,
  Check,
  Users,
  Wrench,
  Disc,
  Timer,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  MapPin,
  Radio,
  X,
  Droplets,
  Sun,
  Plus,
  Trash2,
  LayoutGrid,
  Car,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';

const STORAGE_KEY = 'ftr_pitwall_strategy_v1';
const EVENT_SIGNUPS_STORAGE_KEY = 'ftr_pitwall_event_signups_v1';
const ROOM_PIN_STORAGE_KEY = 'ftr_pitwall_room_pin_v1';
const CLIENT_INSTANCE_ID =
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `ftr-${Math.random().toString(36).slice(2, 10)}`;

const DRIVERS = [
  'Bruno Aguiar',
  'Erich Terezzino',
  'Iuri Soares',
  'Leandro Agiani',
  'Marcelo Da Silva',
  'Mauricio Chara',
  'Paulo Afonso',
  'Rafael Barison',
  'Vitor Justen',
  'Convidado 01',
  'Convidado 02',
  'ND',
];

const TIRE_CORNERS = [
  { key: 'FL', label: 'Dianteiro Esquerdo' },
  { key: 'FR', label: 'Dianteiro Direito' },
  { key: 'RL', label: 'Traseiro Esquerdo' },
  { key: 'RR', label: 'Traseiro Direito' },
];

const PIT_SCENARIOS = [
  { id: '4_tires_fuel', label: '4 pneus + combustível' },
  { id: '2_tires_fuel', label: '2 pneus + combustível' },
  { id: 'fuel_only', label: 'Apenas combustível' },
  { id: 'driver_swap_only', label: 'Somente troca de piloto' },
];

const PT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const LMU_OFFICIAL_WC_EVENTS_2026 = [
  { id: 'imola', wcDate: '2026-07-07', track: '4 Hours of Imola', classes: 'ELMS LMP2, LMP3, LMGT3' },
  { id: 'interlagos', wcDate: '2026-07-14', track: '6 Hours of Interlagos', classes: 'Hypercar, LMGT3' },
  { id: 'cota', wcDate: '2026-09-08', track: '6 Hours of COTA', classes: 'Hypercar, LMGT3' },
  { id: 'silverstone-4h', wcDate: '2026-09-15', track: '4 Hours of Silverstone', classes: 'ELMS LMP2, LMP3, LMGT3' },
  { id: 'fuji', wcDate: '2026-09-29', track: '6 Hours of Fuji', classes: 'Hypercar, LMGT3' },
  { id: 'portimao', wcDate: '2026-10-13', track: '4 Hours of Portimão', classes: 'ELMS LMP2, LMP3, LMGT3' },
  { id: 'lemans', wcDate: '2026-10-20', track: '24 Hours of Le Mans', classes: 'Hypercar, WEC LMP2, LMGT3' },
  { id: 'bahrain', wcDate: '2026-11-10', track: '8 Hours of Bahrain', classes: 'Hypercar, LMGT3' },
  { id: 'monza', wcDate: '2026-11-17', track: '6 Hours of Monza', classes: 'Hypercar, LMGT3' },
  { id: 'silverstone-6h', wcDate: '2026-12-01', track: '6 Hours of Silverstone', classes: 'Hypercar, LMGT3' },
  { id: 'tba-dec', wcDate: '2026-12-15', track: '6 Hours TBA', classes: 'Hypercar, WEC LMP2, LMGT3' },
];

/**
 * Maps each official w/c date to the Saturday & Sunday of that same week
 * and marks past / next / upcoming relative to today.
 */
function buildLmuWeekendCalendar(referenceDate = new Date()) {
  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );

  let foundNext = false;

  return LMU_OFFICIAL_WC_EVENTS_2026.map((ev) => {
    const [y, m, d] = ev.wcDate.split('-').map(Number);
    const wc = new Date(y, m - 1, d);
    const daysUntilSat = (6 - wc.getDay() + 7) % 7;
    const sat = new Date(wc);
    sat.setDate(wc.getDate() + daysUntilSat);
    const sun = new Date(sat);
    sun.setDate(sat.getDate() + 1);

    const satDay = String(sat.getDate()).padStart(2, '0');
    const sunDay = String(sun.getDate()).padStart(2, '0');
    const satMonth = PT_MONTHS[sat.getMonth()];
    const sunMonth = PT_MONTHS[sun.getMonth()];

    const dates =
      sat.getMonth() === sun.getMonth()
        ? `${satDay} & ${sunDay} ${sunMonth}`
        : `${satDay} ${satMonth} & ${sunDay} ${sunMonth}`;

    // Only switch away from the current event on the Monday after Sunday's race
    const mondayAfter = new Date(sun);
    mondayAfter.setDate(sun.getDate() + 1);

    let status = 'upcoming';
    if (today >= mondayAfter) {
      status = 'past';
    } else if (!foundNext) {
      status = 'next';
      foundNext = true;
    }

    return {
      ...ev,
      dates,
      status,
    };
  });
}

const LMU_CAR_CLASSES = [
  { id: 'Hypercar', label: 'Hypercar', badgeClass: 'bg-red-500/20 text-red-400 border-red-500/40' },
  { id: 'LMP2', label: 'LMP2', badgeClass: 'bg-blue-500/20 text-blue-400 border-blue-500/40' },
  { id: 'LMP3', label: 'LMP3', badgeClass: 'bg-purple-500/20 text-purple-400 border-purple-500/40' },
  { id: 'LMGT3', label: 'LMGT3', badgeClass: 'bg-orange-500/20 text-orange-400 border-orange-500/40' },
  { id: 'GTE', label: 'GTE', badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' },
];

const LMU_CARS = [
  // Hypercar
  { id: 'alpine-a424', name: 'Alpine A424', brand: 'alpine', classId: 'Hypercar' },
  { id: 'aston-valkyrie', name: 'Aston Martin Valkyrie AMR-LMH', brand: 'aston', classId: 'Hypercar' },
  { id: 'bmw-m-hybrid-v8', name: 'BMW M Hybrid V8', brand: 'bmw', classId: 'Hypercar' },
  { id: 'cadillac-v-series-r', name: 'Cadillac V-Series.R', brand: 'cadillac', classId: 'Hypercar' },
  { id: 'ferrari-499p', name: 'Ferrari 499P', brand: 'ferrari', classId: 'Hypercar' },
  { id: 'genesis-gmr-001', name: 'Genesis GMR-001', brand: 'genesis', classId: 'Hypercar' },
  { id: 'glickenhaus-007', name: 'Glickenhaus SCG 007', brand: 'glickenhaus', classId: 'Hypercar' },
  { id: 'isotta-tipo6', name: 'Isotta Fraschini Tipo 6 LMH-C', brand: 'isotta', classId: 'Hypercar' },
  { id: 'lamborghini-sc63', name: 'Lamborghini SC63', brand: 'lamborghini', classId: 'Hypercar' },
  { id: 'peugeot-9x8', name: 'Peugeot 9X8', brand: 'peugeot', classId: 'Hypercar' },
  { id: 'porsche-963', name: 'Porsche 963', brand: 'porsche', classId: 'Hypercar' },
  { id: 'toyota-gr010', name: 'Toyota GR010 Hybrid', brand: 'toyota', classId: 'Hypercar' },
  { id: 'vanwall-680', name: 'Vanwall Vandervell 680', brand: 'vanwall', classId: 'Hypercar' },
  // LMP2
  { id: 'oreca-07', name: 'Oreca 07 - Gibson', brand: 'oreca', classId: 'LMP2' },
  // LMP3
  { id: 'adess-ad25', name: 'ADESS AD25 / ADESS-03 Evo', brand: 'adess', classId: 'LMP3' },
  { id: 'duqueine-d09', name: 'Duqueine D09', brand: 'duqueine', classId: 'LMP3' },
  { id: 'ginetta-g61', name: 'Ginetta G61-LT-P3 Evo', brand: 'ginetta', classId: 'LMP3' },
  { id: 'ligier-jsp325', name: 'Ligier JS P325', brand: 'ligier', classId: 'LMP3' },
  // LMGT3
  { id: 'aston-vantage-lmgt3', name: 'Aston Martin Vantage AMR LMGT3', brand: 'aston', classId: 'LMGT3' },
  { id: 'bmw-m4-lmgt3', name: 'BMW M4 LMGT3', brand: 'bmw', classId: 'LMGT3' },
  { id: 'corvette-z06-lmgt3', name: 'Chevrolet Corvette Z06 LMGT3.R', brand: 'corvette', classId: 'LMGT3' },
  { id: 'ferrari-296-lmgt3', name: 'Ferrari 296 LMGT3', brand: 'ferrari', classId: 'LMGT3' },
  { id: 'ford-mustang-lmgt3', name: 'Ford Mustang LMGT3', brand: 'ford', classId: 'LMGT3' },
  { id: 'lamborghini-huracan-lmgt3', name: 'Lamborghini Huracán LMGT3 Evo2', brand: 'lamborghini', classId: 'LMGT3' },
  { id: 'lexus-rcf-lmgt3', name: 'Lexus RC F LMGT3', brand: 'lexus', classId: 'LMGT3' },
  { id: 'mclaren-720s-lmgt3', name: 'McLaren 720S LMGT3 Evo', brand: 'mclaren', classId: 'LMGT3' },
  { id: 'mercedes-amg-lmgt3', name: 'Mercedes-AMG LMGT3', brand: 'mercedes', classId: 'LMGT3' },
  { id: 'porsche-911-lmgt3', name: 'Porsche 911 GT3 R (992) LMGT3', brand: 'porsche', classId: 'LMGT3' },
  // GTE
  { id: 'aston-vantage-gte', name: 'Aston Martin Vantage AMR GTE', brand: 'aston', classId: 'GTE' },
  { id: 'corvette-c8r-gte', name: 'Chevrolet Corvette C8.R', brand: 'corvette', classId: 'GTE' },
  { id: 'ferrari-488-gte', name: 'Ferrari 488 GTE Evo', brand: 'ferrari', classId: 'GTE' },
  { id: 'porsche-911-rsr-gte', name: 'Porsche 911 RSR-19', brand: 'porsche', classId: 'GTE' },
];

function ManufacturerLogo({ brand, size = 28 }) {
  const s = size;
  switch (brand) {
    case 'ferrari':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className="shrink-0 bg-transparent">
          <path
            d="M7 5.5h18v10.5c0 6.8-9 11.5-9 11.5s-9-4.7-9-11.5V5.5z"
            fill="#facc15"
            stroke="#dc2626"
            strokeWidth="1.3"
          />
          <path d="M7.6 5.5h5.6v2.6H7.6z" fill="#16a34a" />
          <path d="M13.2 5.5h5.6v2.6h-5.6z" fill="#f8fafc" />
          <path d="M18.8 5.5h5.6v2.6h-5.6z" fill="#dc2626" />
          {/* Prancing Horse silhouette */}
          <path
            d="M17.8 10.2c.8-.5 1.7-.4 2.1.2-.8.6-1.1 1.4-.9 2.3l1.3 1.4-1.3.7-1.1-1-1.3 2 1.7 3.8-1.4.4-1.5-2.8-1.8 2.4-1.3-.6 1.7-2.8-2.2-1.8.8-1.1 1.8 1.2c.6-1.4 1.3-2.9 2.4-4.1z"
            fill="#0f172a"
          />
        </svg>
      );
    case 'porsche':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className="shrink-0 bg-transparent">
          <path
            d="M6.5 4.5h19v11.5c0 6.5-9.5 11.5-9.5 11.5S6.5 22.5 6.5 16V4.5z"
            fill="#d97706"
            stroke="#fde047"
            strokeWidth="1.2"
          />
          <rect x="7.8" y="8" width="8.2" height="5.5" fill="#dc2626" />
          <rect x="16" y="8" width="8.2" height="5.5" fill="#111827" />
          <rect x="7.8" y="13.5" width="8.2" height="5.5" fill="#111827" />
          <rect x="16" y="13.5" width="8.2" height="5.5" fill="#dc2626" />
          <path d="M12.5 10.5h7v7c0 2.5-3.5 4.2-3.5 4.2s-3.5-1.7-3.5-4.2v-7z" fill="#facc15" stroke="#111827" strokeWidth="0.9" />
          <circle cx="16" cy="14.2" r="1.4" fill="#111827" />
        </svg>
      );
    case 'bmw':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className="shrink-0 bg-transparent">
          <circle cx="16" cy="16" r="12.5" stroke="#cbd5e1" strokeWidth="1.6" />
          <circle cx="16" cy="16" r="10.2" fill="#0f172a" stroke="#64748b" strokeWidth="0.8" />
          <path d="M16 7.5a8.5 8.5 0 0 1 8.5 8.5H16V7.5z" fill="#38bdf8" />
          <path d="M7.5 16A8.5 8.5 0 0 1 16 7.5V16H7.5z" fill="#f8fafc" />
          <path d="M16 16h8.5a8.5 8.5 0 0 1-8.5 8.5V16z" fill="#f8fafc" />
          <path d="M7.5 16H16v8.5A8.5 8.5 0 0 1 7.5 16z" fill="#38bdf8" />
        </svg>
      );
    case 'toyota':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className="shrink-0 bg-transparent">
          <ellipse cx="16" cy="14" rx="12" ry="8" stroke="#cbd5e1" strokeWidth="1.7" />
          <ellipse cx="16" cy="14" rx="3.4" ry="7.6" stroke="#e2e8f0" strokeWidth="1.4" />
          <ellipse cx="16" cy="10.2" rx="7.6" ry="2.6" stroke="#ef4444" strokeWidth="1.3" />
          <text x="16" y="28" textAnchor="middle" fontSize="6" fontWeight="900" fill="#ef4444" fontFamily="sans-serif" letterSpacing="0.6">
            TOYOTA
          </text>
        </svg>
      );
    case 'aston':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className="shrink-0 bg-transparent">
          <path
            d="M2.5 12h27l-3.8 7H6.3l-3.8-7z"
            stroke="#e2e8f0"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <path d="M4.2 14.3h23.6M5.4 16.6h21.2" stroke="#94a3b8" strokeWidth="0.9" />
          <rect x="9.5" y="12.6" width="13" height="4.2" rx="0.8" fill="#059669" stroke="#a7f3d0" strokeWidth="0.8" />
          <text x="16" y="15.8" textAnchor="middle" fontSize="3.4" fontWeight="800" fill="#ffffff" fontFamily="sans-serif">
            ASTON MARTIN
          </text>
        </svg>
      );
    case 'cadillac':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className="shrink-0 bg-transparent">
          <path
            d="M4.5 9h23l-2.4 10.5L16 24l-9.1-4.5L4.5 9z"
            fill="#0f172a"
            stroke="#e2e8f0"
            strokeWidth="1.4"
          />
          <path d="M7 11h5.5v4H7z" fill="#f8fafc" />
          <path d="M12.5 11H19v4h-6.5z" fill="#dc2626" />
          <path d="M19 11h6v4h-6z" fill="#eab308" />
          <path d="M8 15h6.5v3.8L16 20.5V15H8z" fill="#2563eb" />
          <path d="M16 15v5.5l7.5-2.5V15H16z" fill="#cbd5e1" />
        </svg>
      );
    case 'alpine':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className="shrink-0 bg-transparent">
          <path
            d="M4.5 22L18 7.5h4.2L19 22h-3.6l1.3-6.5H10l-3.8 6.5H4.5z"
            fill="#38bdf8"
          />
          <path d="M4.5 18.2h21.5l-1.5 2.4H3l1.5-2.4z" fill="#0284c7" />
        </svg>
      );
    case 'peugeot':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className="shrink-0 bg-transparent">
          <path
            d="M6.5 4.5h19v11.5c0 6.5-9.5 11-9.5 11s-9.5-4.5-9.5-11V4.5z"
            fill="#0f172a"
            stroke="#e2e8f0"
            strokeWidth="1.3"
          />
          <path
            d="M11 10.5l4-2.5 5 1.5-1.5 3 2.5 2-3.5 1.5-1 3.5-3-1.5-2.5-3.5z"
            stroke="#f8fafc"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <text x="16" y="8" textAnchor="middle" fontSize="3.4" fontWeight="800" fill="#cbd5e1" fontFamily="sans-serif">
            PEUGEOT
          </text>
        </svg>
      );
    case 'lamborghini':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className="shrink-0 bg-transparent">
          <path
            d="M6.5 5h19v11.5c0 6-9.5 10.5-9.5 10.5S6.5 22.5 6.5 16.5V5z"
            fill="#090d16"
            stroke="#eab308"
            strokeWidth="1.5"
          />
          <path
            d="M11 18.5c1.5-3.5 4-5.5 7.5-5.5l2 2.2-2.2 1.2 1.7 3.1-2.2.8-1.4-2.5-2.8 1.9L11 18.5z"
            fill="#facc15"
          />
        </svg>
      );
    case 'mclaren':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className="shrink-0 bg-transparent">
          <path
            d="M4 21.5c5.8-8.2 15.8-12.5 24-9-5.8 2.2-10.5 5.4-13.6 10.4-2.6-1-5.8-1.4-10.4-1.4z"
            fill="#f97316"
          />
          <text x="15" y="27.5" textAnchor="middle" fontSize="5.2" fontWeight="900" fill="#e2e8f0" fontFamily="sans-serif" fontStyle="italic">
            McLaren
          </text>
        </svg>
      );
    case 'mercedes':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className="shrink-0 bg-transparent">
          <circle cx="16" cy="16" r="12" stroke="#cbd5e1" strokeWidth="1.6" />
          <path d="M16 4.5v11.5m0 0l-9.5 6.2m9.5-6.2l9.5 6.2" stroke="#e2e8f0" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'ford':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className="shrink-0 bg-transparent">
          <ellipse cx="16" cy="16" rx="13.5" ry="7.8" fill="#1d4ed8" stroke="#e2e8f0" strokeWidth="1.4" />
          <ellipse cx="16" cy="16" rx="11.8" ry="6.2" stroke="#93c5fd" strokeWidth="0.7" />
          <text x="16" y="18.8" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#ffffff" fontFamily="serif" fontStyle="italic">
            Ford
          </text>
        </svg>
      );
    case 'corvette':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className="shrink-0 bg-transparent">
          {/* Left checkered flag wing */}
          <path d="M3.5 9.5L15.5 16l-2.8 6.5L5.8 18z" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
          <path d="M5.5 11.5l3 1.8-.8 2.3-3-1.8zM9.2 14.5l3 1.7-.7 2.2-3-1.7z" fill="#0f172a" />
          {/* Right red Corvette wing */}
          <path d="M28.5 9.5L16.5 16l2.8 6.5 6.9-4.5z" fill="#ef4444" stroke="#cbd5e1" strokeWidth="1" />
          <path d="M21 15.5l4-2.2-.7 2.4-4 2.1z" fill="#facc15" />
        </svg>
      );
    case 'lexus':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className="shrink-0 bg-transparent">
          <ellipse cx="16" cy="15.5" rx="12" ry="8.8" stroke="#cbd5e1" strokeWidth="1.6" />
          <path d="M14.2 8.2L10.5 19.5h10.5" stroke="#f8fafc" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'isotta':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className="shrink-0 bg-transparent">
          <circle cx="16" cy="16" r="12" stroke="#60a5fa" strokeWidth="1.4" />
          <circle cx="16" cy="16" r="9.4" stroke="#93c5fd" strokeWidth="0.9" strokeDasharray="2 1.2" />
          <text x="16" y="19.8" textAnchor="middle" fontSize="10.5" fontWeight="900" fill="#f8fafc" fontFamily="serif">
            IF
          </text>
        </svg>
      );
    case 'oreca':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className="shrink-0 bg-transparent">
          <path d="M4 11h24l-2 10H2l2-10z" stroke="#38bdf8" strokeWidth="1.3" />
          <text x="15" y="18.2" textAnchor="middle" fontSize="6.6" fontWeight="900" fill="#f8fafc" fontFamily="sans-serif" fontStyle="italic">
            ORECA
          </text>
        </svg>
      );
    default: {
      const tagMap = {
        ligier: { txt: 'LG', stroke: '#3b82f6', fg: '#93c5fd' },
        duqueine: { txt: 'DQ', stroke: '#a855f7', fg: '#e9d5ff' },
        ginetta: { txt: 'GN', stroke: '#f97316', fg: '#fed7aa' },
        adess: { txt: 'AD', stroke: '#6366f1', fg: '#c7d2fe' },
        genesis: { txt: 'GN', stroke: '#eab308', fg: '#fef08a' },
        glickenhaus: { txt: 'SCG', stroke: '#ef4444', fg: '#fecaca' },
        vanwall: { txt: 'VW', stroke: '#22c55e', fg: '#bbf7d0' },
      };
      const cfg = tagMap[brand] || { txt: 'LMU', stroke: '#64748b', fg: '#f8fafc' };
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none" className="shrink-0 bg-transparent">
          <rect x="3.5" y="6" width="25" height="20" rx="5" stroke={cfg.stroke} strokeWidth="1.5" />
          <text x="16" y="19.5" textAnchor="middle" fontSize="9.5" fontWeight="900" fill={cfg.fg} fontFamily="sans-serif">
            {cfg.txt}
          </text>
        </svg>
      );
    }
  }
}

const LMU_CIRCUITS = [
  {
    id: 'imola',
    name: 'Autodromo Internazionale Enzo e Dino Ferrari (Imola)',
    shortName: 'Imola',
    country: 'Itália',
    flag: '🇮🇹',
    svgPath: 'M14 50 C20 46, 28 42, 36 39 C43 36, 50 37, 62 36 C71 36, 75 33, 77 26 C78 21, 80 18, 88 18 C96 18, 103 16, 106 18 C108 20, 102 25, 98 31 C94 38, 90 48, 76 50 C62 51, 48 49, 36 51 C26 53, 18 55, 14 52 C12 51, 12 51, 14 50 Z',
  },
  {
    id: 'portimao',
    name: 'Autódromo Internacional do Algarve (Portimão)',
    shortName: 'Portimão',
    country: 'Portugal',
    flag: '🇵🇹',
    svgPath: 'M16 54 L98 54 C108 54, 110 44, 102 34 C96 26, 91 20, 86 21 C82 22, 83 30, 89 35 C94 39, 92 42, 84 42 C78 42, 74 34, 73 25 C72 17, 67 16, 63 22 C59 28, 53 29, 44 26 C35 23, 29 24, 30 29 C31 33, 44 35, 53 38 C59 40, 56 42, 46 42 L29 41 C25 41, 24 36, 23 31 C22 26, 17 28, 15 37 C13 45, 13 54, 16 54 Z',
  },
  {
    id: 'interlagos',
    name: 'Autódromo José Carlos Pace (Interlagos)',
    shortName: 'Interlagos',
    country: 'Brasil',
    flag: '🇧🇷',
    svgPath: 'M14 34 C14 25, 27 18, 46 16 C64 14, 78 14, 88 16 C99 18, 106 25, 106 33 C106 39, 98 38, 92 31 C87 25, 83 20, 79 22 C75 24, 75 30, 71 32 C66 34, 62 25, 54 27 C46 29, 46 37, 56 41 C66 44, 76 46, 83 48 C89 50, 87 56, 75 56 C58 56, 40 54, 28 52 C18 50, 14 42, 14 34 Z',
  },
  {
    id: 'monza',
    name: 'Autodromo Nazionale Monza',
    shortName: 'Monza',
    country: 'Itália',
    flag: '🇮🇹',
    svgPath: 'M20 15 C25 14, 29 17, 34 25 C40 34, 46 41, 56 42 L100 43 C108 43, 108 53, 100 53 L48 53 C36 53, 28 48, 24 38 C20 30, 18 24, 16 19 C15 16, 17 15, 20 15 Z',
  },
  {
    id: 'bahrain',
    name: 'Bahrain International Circuit',
    shortName: 'Bahrain',
    country: 'Bahrein',
    flag: '🇧🇭',
    svgPath: 'M20 55 C18 55, 18 46, 19 36 C20 26, 22 18, 25 14 C27 12, 31 14, 36 20 C42 26, 48 31, 49 34 C50 37, 41 37, 36 38 C32 39, 32 42, 38 42 L62 43 C68 43, 68 38, 64 33 C60 28, 66 16, 73 16 C79 16, 86 27, 94 40 C100 49, 105 55, 98 56 L22 56 Z',
  },
  {
    id: 'barcelona',
    name: 'Circuit de Barcelona-Catalunya',
    shortName: 'Barcelona',
    country: 'Espanha',
    flag: '🇪🇸',
    svgPath: 'M20 53 L100 53 C106 53, 108 46, 105 42 C102 38, 95 40, 94 36 C93 32, 101 32, 103 28 C105 24, 101 20, 94 22 C87 24, 81 26, 75 23 C69 20, 64 19, 59 24 C54 29, 50 34, 42 34 L31 34 C27 34, 27 29, 32 29 L44 29 C50 29, 50 22, 43 22 L21 22 C13 22, 12 36, 20 40 C26 43, 27 46, 24 49 C20 51, 17 53, 20 53 Z',
  },
  {
    id: 'lemans',
    name: 'Circuit de la Sarthe (Le Mans)',
    shortName: 'Le Mans',
    country: 'França',
    flag: '🇫🇷',
    svgPath: 'M14 31 C16 27, 28 24, 44 21 C62 18, 78 15, 94 14 C103 14, 108 15, 106 20 C103 27, 96 39, 90 44 C86 47, 81 49, 76 51 C70 53, 64 52, 59 49 C55 47, 52 52, 45 53 C36 53, 26 53, 21 50 C16 47, 12 36, 14 31 Z',
  },
  {
    id: 'spa',
    name: 'Circuit de Spa-Francorchamps',
    shortName: 'Spa',
    country: 'Bélgica',
    flag: '🇧🇪',
    svgPath: 'M14 52 C18 45, 23 36, 30 30 C38 24, 52 19, 68 16 C78 14, 84 15, 89 18 C93 20, 96 16, 101 20 C106 24, 105 30, 98 31 C91 31, 84 26, 78 28 C72 30, 72 36, 78 40 C86 44, 96 48, 100 52 C102 55, 96 58, 90 55 C82 51, 74 42, 66 38 C59 34, 51 36, 42 42 C32 48, 22 54, 16 55 C12 56, 12 54, 14 52 Z',
  },
  {
    id: 'cota',
    name: 'Circuit of the Americas (COTA)',
    shortName: 'COTA',
    country: 'EUA',
    flag: '🇺🇸',
    svgPath: 'M36 55 C30 50, 20 41, 14 35 C11 32, 16 28, 21 28 C26 28, 30 37, 34 38 C38 39, 41 33, 38 28 C35 24, 39 21, 43 24 C47 28, 48 33, 52 31 C56 29, 58 24, 66 23 C80 21, 96 17, 104 15 C109 14, 108 20, 102 24 C95 28, 84 27, 74 30 C64 33, 54 40, 46 45 C40 49, 39 57, 36 55 Z',
  },
  {
    id: 'paul-ricard',
    name: 'Circuit Paul Ricard',
    shortName: 'Paul Ricard',
    country: 'França',
    flag: '🇫🇷',
    svgPath: 'M14 19 C11 15, 16 13, 22 16 C36 22, 52 27, 68 31 C82 34, 94 36, 101 39 C108 42, 107 49, 101 52 C95 55, 88 53, 88 47 C88 43, 84 42, 76 43 C66 44, 58 41, 46 34 C34 28, 20 23, 14 19 Z',
  },
  {
    id: 'daytona',
    name: 'Daytona International Speedway',
    shortName: 'Daytona',
    country: 'Daytona, Flórida, EUA',
    flag: '🇺🇸',
    svgPath: 'M16 44 C10 32, 16 18, 30 16 L84 12 C104 12, 110 26, 106 40 C102 52, 92 56, 76 56 L28 56 C20 56, 16 50, 16 44 Z M30 16 C28 24, 27 32, 29 36 C31 39, 37 39, 46 39 L61 39 C68 39, 70 33, 68 25 C66 18, 76 16, 86 18 C94 20, 96 28, 92 40 C90 45, 86 47, 81 47 C75 48, 74 52, 76 56',
  },
  {
    id: 'fuji',
    name: 'Fuji Speedway',
    shortName: 'Fuji',
    country: 'Japão',
    flag: '🇯🇵',
    svgPath: 'M16 39 C14 37, 22 27, 31 19 C35 15, 41 16, 48 20 C56 24, 61 28, 63 36 C65 42, 71 45, 75 40 C80 34, 83 24, 88 22 C93 20, 99 23, 102 30 C106 38, 108 43, 101 45 C88 49, 74 53, 64 54 C52 54, 26 44, 16 39 Z',
  },
  {
    id: 'indianapolis',
    name: 'Indianapolis Motor Speedway (Road Course)',
    shortName: 'Indianapolis',
    country: 'Speedway, Indiana, EUA',
    flag: '🇺🇸',
    svgPath: 'M16 54 L94 54 C104 54, 108 46, 108 34 C108 20, 98 13, 86 14 C75 15, 72 22, 72 31 C72 36, 68 37, 60 37 L49 37 C44 37, 42 43, 36 43 C30 43, 27 40, 22 44 C17 48, 13 54, 16 54 Z M93 54 C93 48, 91 46, 86 46 C82 46, 81 42, 82 38 C83 35, 92 35, 96 33 C100 31, 100 22, 90 21 C82 20, 79 25, 78 29',
  },
  {
    id: 'lusail',
    name: 'Lusail International Circuit (Qatar)',
    shortName: 'Qatar',
    country: 'Catar',
    flag: '🇶🇦',
    svgPath: 'M22 55 L96 55 C101 55, 100 50, 94 44 C88 38, 86 33, 88 27 C91 21, 91 18, 83 18 C75 18, 67 28, 63 34 C60 38, 58 34, 59 26 C60 19, 51 14, 46 15 C42 16, 42 26, 38 31 C35 35, 32 30, 29 23 C26 18, 20 19, 21 25 C22 31, 27 35, 25 39 C23 42, 19 44, 19 49 C19 53, 20 55, 22 55 Z',
  },
  {
    id: 'road-atlanta',
    name: 'Michelin Raceway Road Atlanta',
    shortName: 'Road Atlanta',
    country: 'Braselton, Georgia, EUA',
    flag: '🇺🇸',
    svgPath: 'M15 53 C14 51, 20 45, 26 41 C31 38, 35 40, 39 43 C43 45, 48 40, 53 35 C57 31, 56 28, 52 23 C47 18, 49 15, 57 15 C70 14, 84 13, 95 14 C103 14, 107 19, 102 25 C94 33, 84 42, 76 47 C66 52, 54 55, 44 55 C34 55, 28 53, 22 54 C18 55, 16 55, 15 53 Z',
  },
  {
    id: 'sebring',
    name: 'Sebring International Raceway',
    shortName: 'Sebring',
    country: 'EUA',
    flag: '🇺🇸',
    svgPath: 'M18 54 C15 53, 24 42, 34 31 C42 22, 48 15, 55 15 C61 15, 64 19, 64 26 C64 34, 72 38, 83 39 C92 40, 94 49, 85 50 C74 50, 58 50, 48 49 C43 48, 41 42, 43 37 C45 32, 52 29, 52 26 C52 24, 46 26, 40 33 C33 41, 30 46, 32 50 C34 53, 22 55, 18 54 Z',
  },
  {
    id: 'silverstone',
    name: 'Silverstone Circuit',
    shortName: 'Silverstone',
    country: 'Reino Unido',
    flag: '🇬🇧',
    svgPath: 'M17 41 C15 39, 23 28, 30 21 C34 17, 39 19, 46 23 C54 27, 58 32, 62 39 C65 44, 74 44, 75 37 C76 31, 75 24, 81 19 C86 15, 92 19, 97 27 C102 35, 107 41, 101 45 C94 49, 84 54, 77 54 C71 54, 69 47, 64 48 C60 49, 59 54, 52 53 C40 50, 22 45, 17 41 Z',
  },
  {
    id: 'long-beach',
    name: 'Long Beach Grand Prix Circuit',
    shortName: 'Long Beach',
    country: 'Long Beach, Califórnia, EUA',
    flag: '🇺🇸',
    svgPath: 'M20 38 C16 32, 24 18, 34 15 C42 13, 52 18, 66 25 L96 36 C104 34, 108 38, 104 44 C108 48, 104 54, 96 52 L58 37 C52 35, 48 42, 44 50 C40 56, 30 50, 20 38 Z',
  },
  {
    id: 'watkins-glen',
    name: 'Watkins Glen International',
    shortName: 'Watkins Glen',
    country: 'Watkins Glen, Nova York, EUA',
    flag: '🇺🇸',
    svgPath: 'M16 43 C14 41, 24 38, 32 34 C38 31, 40 24, 42 18 C44 14, 49 14, 56 15 C70 17, 86 20, 96 22 C101 23, 103 28, 106 39 C107 44, 104 46, 97 47 C91 48, 88 47, 86 41 C84 34, 82 31, 75 32 C68 33, 62 35, 60 42 C58 48, 55 51, 48 53 C41 56, 36 57, 30 53 C24 49, 18 45, 16 43 Z',
  },
  {
    id: 'laguna-seca',
    name: 'WeatherTech Raceway Laguna Seca',
    shortName: 'Laguna Seca',
    country: 'Monterey, Califórnia, EUA',
    flag: '🇺🇸',
    svgPath: 'M22 51 C20 49, 28 43, 33 38 C36 35, 29 32, 23 28 C19 25, 22 20, 29 18 C44 15, 60 13, 72 12 C78 11, 82 14, 87 21 C91 27, 96 32, 93 35 C90 38, 76 39, 67 41 C61 42, 60 48, 63 52 C66 55, 74 52, 79 49 C83 47, 86 52, 81 55 C74 58, 62 59, 48 56 C36 54, 24 53, 22 51 Z',
  },
];

function CircuitTrackSvg({ svgPath, className = 'h-12 w-20', spin3d = false }) {
  return (
    <svg
      viewBox="0 0 120 70"
      className={`${className} ${spin3d ? 'circuit-orbit-3d' : ''} bg-transparent drop-shadow-[0_0_5px_rgba(56,189,248,0.3)]`}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={svgPath} stroke="#0f172a" strokeWidth="6.5" opacity="0.85" />
      <path d={svgPath} stroke="#334155" strokeWidth="4.4" opacity="0.7" />
      <path d={svgPath} stroke="currentColor" strokeWidth="2.4" />
    </svg>
  );
}

const DRIVER_PORTRAIT_PRESETS = {
  'Bruno Aguiar': {
    suit: '#1e3a8a',
    suitDark: '#172554',
    stripe: '#f97316',
    hair: '#1c1917',
    hairHi: '#44403c',
    skin: '#f1c27d',
    skinDark: '#c68642',
    shades: true,
    helmet: false,
    bgTop: '#1e293b',
    bgBot: '#0f172a',
  },
  'Erich Terezzino': {
    suit: '#18181b',
    suitDark: '#09090b',
    stripe: '#f97316',
    hair: '#3b2f2f',
    hairHi: '#78716c',
    skin: '#ffdbac',
    skinDark: '#d9a066',
    shades: false,
    bald: true,
    helmet: false,
    bgTop: '#172554',
    bgBot: '#0f172a',
  },
  'Iuri Soares': {
    suit: '#f1f5f9',
    suitDark: '#cbd5e1',
    stripe: '#334155',
    hair: '#0f172a',
    hairHi: '#334155',
    skin: '#e0ac69',
    skinDark: '#b37b3b',
    shades: true,
    helmet: false,
    bgTop: '#14532d',
    bgBot: '#052e16',
  },
  'Leandro Agiani': {
    suit: '#18181b',
    suitDark: '#09090b',
    stripe: '#f97316',
    hair: '#292524',
    hairHi: '#57534e',
    skin: '#f1c27d',
    skinDark: '#c68642',
    shades: false,
    prescription: true,
    helmet: false,
    bgTop: '#1e3a8a',
    bgBot: '#0f172a',
  },
  'Marcelo Da Silva': {
    suit: '#0f766e',
    suitDark: '#115e59',
    stripe: '#eab308',
    hair: '#1c1917',
    hairHi: '#44403c',
    skin: '#e0ac69',
    skinDark: '#b37b3b',
    shades: false,
    helmet: false,
    bgTop: '#134e4a',
    bgBot: '#0f172a',
  },
  'Mauricio Chara': {
    suit: '#1e3a8a',
    suitDark: '#172554',
    stripe: '#f97316',
    hair: '#0f172a',
    hairHi: '#334155',
    skin: '#ffdbac',
    skinDark: '#e2b482',
    shades: false,
    eastAsianEyes: true,
    helmet: false,
    bgTop: '#172554',
    bgBot: '#0f172a',
  },
  'Paulo Afonso': {
    suit: '#18181b',
    suitDark: '#09090b',
    stripe: '#84cc16',
    hair: '#94a3b8',
    hairHi: '#e2e8f0',
    skin: '#f1c27d',
    skinDark: '#c68642',
    shades: true,
    helmet: false,
    bgTop: '#14532d',
    bgBot: '#0f172a',
  },
  'Rafael Barison': {
    suit: '#18181b',
    suitDark: '#09090b',
    stripe: '#f97316',
    hair: '#1c1917',
    hairHi: '#57534e',
    skin: '#ffdbac',
    skinDark: '#d9a066',
    shades: false,
    helmet: false,
    bgTop: '#0c4a6e',
    bgBot: '#0f172a',
  },
  'Vitor Justen': {
    suit: '#0f766e',
    suitDark: '#115e59',
    stripe: '#facc15',
    hair: '#78350f',
    hairHi: '#b45309',
    skin: '#f1c27d',
    skinDark: '#c68642',
    shades: false,
    helmet: false,
    bgTop: '#134e4a',
    bgBot: '#0f172a',
  },
  'Convidado 01': {
    suit: '#475569',
    suitDark: '#334155',
    stripe: '#eab308',
    hair: '#0f172a',
    hairHi: '#475569',
    skin: '#e0ac69',
    skinDark: '#b37b3b',
    shades: true,
    helmet: false,
    bgTop: '#1e293b',
    bgBot: '#0f172a',
  },
  'Convidado 02': {
    suit: '#334155',
    suitDark: '#1e293b',
    stripe: '#22c55e',
    hair: '#3f3f46',
    hairHi: '#71717a',
    skin: '#ffdbac',
    skinDark: '#d9a066',
    shades: true,
    helmet: false,
    bgTop: '#1e293b',
    bgBot: '#0f172a',
  },
};

function DriverAvatar90s({ driver, size = 48 }) {
  if (driver === 'ND') {
    return (
      <div
        className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border-2 border-[#475569] bg-[#0f172a] shadow-md"
        style={{ width: size, height: size }}
        title="Piloto: ND (Não Definido)"
      >
        <svg width={size} height={size} viewBox="0 0 64 64" className="block">
          <rect width="64" height="64" fill="#0f172a" />
          <path
            d="M10 64 C11 50, 19 43, 32 43 C45 43, 53 50, 54 64 Z"
            fill="#334155"
          />
          <circle cx="32" cy="24" r="12" fill="#334155" />
          <path
            d="M21 22 C21 15, 26 11, 32 11 C38 11, 43 15, 43 22 L41 26 L23 26 Z"
            fill="#1e293b"
          />
        </svg>
      </div>
    );
  }

  const p = DRIVER_PORTRAIT_PRESETS[driver] || DRIVER_PORTRAIT_PRESETS['Convidado 01'];

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border-2 border-[#64748b] bg-[#0f172a] shadow-md"
      style={{ width: size, height: size }}
      title={`Piloto: ${driver}`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        shapeRendering="crispEdges"
        className="block"
      >
        {/* Mega Drive 16-bit Dithered Backdrop */}
        <rect width="64" height="36" fill={p.bgTop} />
        <rect y="36" width="64" height="28" fill={p.bgBot} />
        <rect y="2" width="64" height="1" fill="#ffffff" fillOpacity="0.06" />
        <rect y="10" width="64" height="1" fill="#ffffff" fillOpacity="0.05" />
        <rect y="18" width="64" height="1" fill="#ffffff" fillOpacity="0.04" />
        <rect y="26" width="64" height="1" fill="#ffffff" fillOpacity="0.04" />
        {/* Checkered Pitwall Banner Strip */}
        <rect x="0" y="34" width="8" height="2" fill="#eab308" fillOpacity="0.35" />
        <rect x="16" y="34" width="8" height="2" fill="#eab308" fillOpacity="0.35" />
        <rect x="32" y="34" width="8" height="2" fill="#eab308" fillOpacity="0.35" />
        <rect x="48" y="34" width="8" height="2" fill="#eab308" fillOpacity="0.35" />

        {/* Racing Suit Shoulders & Torso */}
        <path d="M6 64 L8 48 L18 42 L46 42 L56 48 L58 64 Z" fill={p.suit} />
        {/* Shoulder Shading */}
        <path d="M6 64 L8 48 L15 44 L15 64 Z" fill={p.suitDark} />
        <path d="M58 64 L56 48 L49 44 L49 64 Z" fill={p.suitDark} />
        {/* Suit Vertical Stripes */}
        <rect x="17" y="43" width="3" height="21" fill={p.stripe} />
        <rect x="44" y="43" width="3" height="21" fill={p.stripe} />
        {/* Center Zipper Placket */}
        <rect x="30" y="44" width="4" height="20" fill="#0f172a" />
        <rect x="31" y="45" width="2" height="18" fill="#cbd5e1" />
        {/* Velcro Racing Collar */}
        <rect x="22" y="40" width="20" height="6" fill="#f8fafc" />
        <rect x="24" y="41" width="16" height="4" fill={p.suitDark} />
        <rect x="29" y="41" width="6" height="4" fill="#eab308" />
        {/* Chest Sponsor Patches */}
        <rect x="21" y="50" width="7" height="4" fill="#f8fafc" />
        <rect x="22" y="51" width="5" height="2" fill="#dc2626" />
        <rect x="36" y="50" width="7" height="4" fill="#f8fafc" />
        <rect x="37" y="51" width="5" height="2" fill="#0f172a" />

        {/* Neck & Chin Shadow */}
        <rect x="26" y="34" width="12" height="8" fill={p.skinDark} />
        <rect x="28" y="34" width="8" height="7" fill={p.skin} />

        {p.helmet ? (
          <>
            {/* Iconic Senna-inspired Yellow/Green/Blue 16-bit Helmet */}
            <path d="M16 26 C16 12, 22 6, 32 6 C42 6, 48 12, 48 26 L46 37 L18 37 Z" fill="#facc15" />
            {/* Helmet Top Highlight */}
            <path d="M22 10 C27 7, 37 7, 42 10 L40 13 C35 11, 29 11, 24 13 Z" fill="#fef08a" />
            {/* Classic Green & Blue Racing Stripes */}
            <rect x="16" y="21" width="32" height="3" fill="#16a34a" />
            <rect x="16" y="24" width="32" height="2" fill="#1d4ed8" />
            {/* Visor Opening */}
            <rect x="20" y="17" width="24" height="10" rx="2" fill="#0f172a" />
            {/* Visor Glare */}
            <rect x="22" y="19" width="7" height="2" fill="#38bdf8" />
            <rect x="35" y="19" width="5" height="2" fill="#38bdf8" />
            {/* Chin Guard */}
            <rect x="21" y="29" width="22" height="7" fill="#eab308" />
            <rect x="27" y="31" width="10" height="3" fill="#0f172a" />
          </>
        ) : (
          <>
            {/* Ears */}
            <rect x="18" y="22" width="3" height="7" fill={p.skinDark} />
            <rect x="43" y="22" width="3" height="7" fill={p.skinDark} />

            {/* Sculpted Face */}
            <path d="M20 14 L44 14 L44 30 L38 37 L26 37 L20 30 Z" fill={p.skin} />
            {/* Jawline & Cheek Shading */}
            <path d="M20 26 L23 30 L27 35 L37 35 L41 30 L44 26 L44 30 L38 37 L26 37 L20 30 Z" fill={p.skinDark} />

            {p.bald ? (
              <>
                {/* Bald Head Top Dome + Scalp Highlight + Side Hair */}
                <path d="M20 15 C20 8, 25 6, 32 6 C39 6, 44 8, 44 15 Z" fill={p.skin} />
                <rect x="25" y="9" width="10" height="2" fill="#ffffff" fillOpacity="0.35" />
                <rect x="27" y="11" width="6" height="1" fill="#ffffff" fillOpacity="0.22" />
                <rect x="19" y="16" width="2" height="6" fill={p.hair} />
                <rect x="43" y="16" width="2" height="6" fill={p.hair} />
              </>
            ) : (
              <>
                {/* Forehead Highlight */}
                <rect x="25" y="16" width="14" height="3" fill="#ffffff" fillOpacity="0.16" />
                {/* 90s Hair with 16-bit Volume & Highlight */}
                <path d="M18 20 L19 10 L25 6 L40 6 L45 10 L46 20 L43 20 L42 14 L22 14 L21 20 Z" fill={p.hair} />
                <rect x="23" y="8" width="14" height="2" fill={p.hairHi} />
                <rect x="26" y="10" width="8" height="2" fill={p.hairHi} />
              </>
            )}

            {/* Eyebrows */}
            <rect x="23" y="20" width="6" height="1.5" fill={p.hair} />
            <rect x="35" y="20" width="6" height="1.5" fill={p.hair} />

            {/* Eyes, Prescription Glasses, or Racing Shades */}
            {p.shades ? (
              <>
                <rect x="22" y="21" width="8" height="4" fill="#0f172a" />
                <rect x="34" y="21" width="8" height="4" fill="#0f172a" />
                <rect x="30" y="22" width="4" height="1.5" fill="#94a3b8" />
                <rect x="23" y="22" width="3" height="1" fill="#38bdf8" />
                <rect x="35" y="22" width="3" height="1" fill="#38bdf8" />
              </>
            ) : p.eastAsianEyes ? (
              <>
                {/* 16-bit East Asian almond eyes */}
                <rect x="23" y="22.5" width="5" height="1.4" fill="#0f172a" />
                <rect x="36" y="22.5" width="5" height="1.4" fill="#0f172a" />
                <rect x="24" y="22.5" width="1.5" height="1" fill="#f8fafc" fillOpacity="0.65" />
                <rect x="37" y="22.5" width="1.5" height="1" fill="#f8fafc" fillOpacity="0.65" />
              </>
            ) : (
              <>
                {/* Eye whites + Pupils */}
                <rect x="23" y="22" width="5" height="2" fill="#f8fafc" />
                <rect x="36" y="22" width="5" height="2" fill="#f8fafc" />
                <rect x="25" y="22" width="2" height="2" fill="#0f172a" />
                <rect x="38" y="22" width="2" height="2" fill="#0f172a" />
                {p.prescription && (
                  <>
                    {/* Prescription Glasses Frame + Subtle Lens Glint */}
                    <rect x="21" y="20.5" width="9" height="5" fill="#bae6fd" fillOpacity="0.22" stroke="#1e293b" strokeWidth="1.2" />
                    <rect x="34" y="20.5" width="9" height="5" fill="#bae6fd" fillOpacity="0.22" stroke="#1e293b" strokeWidth="1.2" />
                    <rect x="30" y="22" width="4" height="1.2" fill="#1e293b" />
                    <rect x="20" y="22" width="1.5" height="1" fill="#1e293b" />
                    <rect x="42.5" y="22" width="1.5" height="1" fill="#1e293b" />
                  </>
                )}
              </>
            )}

            {/* Nose Bridge & Shadow */}
            <rect x="31" y="22" width="2" height="6" fill={p.skinDark} />
            <rect x="30" y="27" width="4" height="1" fill={p.skinDark} />

            {/* Determined 90s Smirk */}
            <rect x="28" y="31" width="8" height="1.5" fill="#7c2d12" />
            <rect x="29" y="31" width="5" height="1" fill="#f8fafc" fillOpacity="0.6" />
          </>
        )}

        {/* CRT Scanline Gloss */}
        <rect x="0" y="0" width="64" height="64" fill="none" stroke="#0f172a" strokeWidth="2" />
      </svg>
    </div>
  );
}

function detectCircuitIdFromEvent(ev) {
  if (!ev) return 'monza';
  const raw = `${ev.id || ''} ${ev.track || ''}`.toLowerCase();
  const matched = LMU_CIRCUITS.find(
    (c) => raw.includes(c.id) || raw.includes(c.shortName.toLowerCase())
  );
  return matched ? matched.id : 'monza';
}

function MiniPirelliTire({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="shrink-0 drop-shadow-sm"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10.5" fill="#0b0f17" stroke="#334155" strokeWidth="1" />
      <path
        d="M5.2 6.8 A9 9 0 0 1 18.8 6.8"
        fill="none"
        stroke="#eab308"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M18.8 17.2 A9 9 0 0 1 5.2 17.2"
        fill="none"
        stroke="#eab308"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="5.2" fill="#1e293b" stroke="#64748b" strokeWidth="1" />
      <circle cx="12" cy="12" r="1.8" fill="#eab308" />
    </svg>
  );
}

const INITIAL_NEXT_EVENT = buildLmuWeekendCalendar().find((e) => e.status === 'next');

const DEFAULT_PARAMS = {
  championship: 'WEC',
  carClass: 'LMGT3',
  carId: 'porsche-911-lmgt3',
  circuitId: detectCircuitIdFromEvent(INITIAL_NEXT_EVENT),
  sessionStart: '14:00',
  raceDurationStr: '06:00',
  lapTimeStr: '01:45.320',
  tankCapacityL: 100,
  fuelPerLapL: 3.1,
  virtualEnergyPerLapPct: 2.1,
  fpDurationMin: 5,
  qualyDurationMin: 15,
  availableTires: 24,
  pitlaneLossSec: 30,
};

const DEFAULT_FULL_TIRES = { FL: 100, FR: 100, RL: 100, RR: 100 };

const DEFAULT_PRE_SESSIONS = {
  fp: {
    driver: 'Leandro Agiani',
    tiresStart: { FL: 100, FR: 100, RL: 100, RR: 100 },
    tiresEnd: { FL: 100, FR: 100, RL: 100, RR: 100 },
  },
  qualy: {
    driver: 'Bruno Aguiar',
    tiresStart: { FL: 100, FR: 100, RL: 100, RR: 100 },
    tiresEnd: { FL: 88, FR: 84, RL: 90, RR: 89 },
    tiresEndEnabled: false,
  },
};

const DEFAULT_STINT_OVERRIDES = {
  1: {
    driver: 'Leandro Agiani',
    pitScenario: '4_tires_fuel',
    tiresStart: { FL: 100, FR: 100, RL: 100, RR: 100 },
    tiresEnd: { FL: 68, FR: 62, RL: 74, RR: 72 },
    tiresEndEnabled: false,
  },
  2: {
    driver: 'Bruno Aguiar',
    pitScenario: '2_tires_fuel',
    tiresStart: { FL: 100, FR: 100, RL: 100, RR: 100 },
    tiresEnd: { FL: 71, FR: 66, RL: 77, RR: 75 },
    tiresEndEnabled: false,
  },
  3: {
    driver: 'Erich Terezzino',
    pitScenario: 'fuel_only',
    tiresStart: { FL: 100, FR: 100, RL: 100, RR: 100 },
    tiresEnd: { FL: 54, FR: 48, RL: 61, RR: 58 },
    tiresEndEnabled: false,
  },
  4: {
    driver: 'Iuri Soares',
    pitScenario: '4_tires_fuel',
    tiresStart: { FL: 100, FR: 100, RL: 100, RR: 100 },
    tiresEnd: { FL: 69, FR: 64, RL: 75, RR: 73 },
    tiresEndEnabled: false,
  },
  5: {
    driver: 'Vitor Justen',
    pitScenario: 'driver_swap_only',
    tiresStart: { FL: 'keep', FR: 'keep', RL: 'keep', RR: 'keep' },
    tiresEnd: { FL: 59, FR: 52, RL: 66, RR: 63 },
    tiresEndEnabled: false,
  },
  6: {
    driver: 'Paulo Afonso',
    pitScenario: 'fuel_only',
    tiresStart: { FL: 100, FR: 100, RL: 100, RR: 100 },
    tiresEnd: { FL: 65, FR: 60, RL: 72, RR: 70 },
    tiresEndEnabled: false,
  },
};

const DEFAULT_EVENT_CONFIG = {
  championship: DEFAULT_PARAMS.championship,
  circuitId: DEFAULT_PARAMS.circuitId,
  sessionStart: DEFAULT_PARAMS.sessionStart,
  raceDurationStr: DEFAULT_PARAMS.raceDurationStr,
  fpDurationMin: DEFAULT_PARAMS.fpDurationMin,
  qualyDurationMin: DEFAULT_PARAMS.qualyDurationMin,
};

const DEFAULT_CAR_PARAMS = {
  carClass: DEFAULT_PARAMS.carClass,
  carId: DEFAULT_PARAMS.carId,
  lapTimeStr: DEFAULT_PARAMS.lapTimeStr,
  tankCapacityL: DEFAULT_PARAMS.tankCapacityL,
  fuelPerLapL: DEFAULT_PARAMS.fuelPerLapL,
  virtualEnergyPerLapPct: DEFAULT_PARAMS.virtualEnergyPerLapPct,
  availableTires: DEFAULT_PARAMS.availableTires,
  pitlaneLossSec: DEFAULT_PARAMS.pitlaneLossSec,
};

const GLOBAL_PARAM_KEYS = new Set([
  'championship',
  'circuitId',
  'sessionStart',
  'raceDurationStr',
  'fpDurationMin',
  'qualyDurationMin',
]);

const CAR_SLOT_PRESETS = {
  'car-1': {
    id: 'car-1',
    defaultLabel: 'FTR #14',
    color: 'amber',
    dotClass: 'bg-[#eab308]',
    ringClass: 'border-amber-500/70 bg-amber-500/15 text-amber-200',
    badgeClass: 'border-amber-500/50 bg-amber-500/15 text-amber-300',
    accentBorder: 'border-l-amber-400',
    defaultCarClass: 'LMGT3',
    defaultCarId: 'porsche-911-lmgt3',
  },
  'car-2': {
    id: 'car-2',
    defaultLabel: 'FTR #88',
    color: 'sky',
    dotClass: 'bg-sky-400',
    ringClass: 'border-sky-500/70 bg-sky-500/15 text-sky-200',
    badgeClass: 'border-sky-500/50 bg-sky-500/15 text-sky-300',
    accentBorder: 'border-l-sky-400',
    defaultCarClass: 'LMGT3',
    defaultCarId: 'ford-mustang-lmgt3',
  },
  'car-3': {
    id: 'car-3',
    defaultLabel: 'FTR #07',
    color: 'emerald',
    dotClass: 'bg-[#22c55e]',
    ringClass: 'border-emerald-500/70 bg-emerald-500/15 text-emerald-200',
    badgeClass: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300',
    accentBorder: 'border-l-emerald-400',
    defaultCarClass: 'LMP2',
    defaultCarId: 'oreca-07',
  },
};

const ALL_CAR_SLOT_IDS = ['car-1', 'car-2', 'car-3'];

function createDefaultCarState(slotId = 'car-1', usePresetSamples = false) {
  const preset = CAR_SLOT_PRESETS[slotId] || CAR_SLOT_PRESETS['car-1'];
  const clearedPre = {
    fp: {
      driver: 'ND',
      tiresStart: { ...DEFAULT_FULL_TIRES },
      tiresEnd: { ...DEFAULT_FULL_TIRES },
    },
    qualy: {
      driver: 'ND',
      tiresStart: { ...DEFAULT_FULL_TIRES },
      tiresEnd: { ...DEFAULT_FULL_TIRES },
      tiresEndEnabled: false,
    },
  };
  const clearedOverrides = {};
  for (let i = 1; i <= 60; i += 1) {
    clearedOverrides[i] = {
      driver: 'ND',
      pitScenario: '4_tires_fuel',
      tiresStart: { ...DEFAULT_FULL_TIRES },
      tiresEnd: { ...DEFAULT_FULL_TIRES },
      tiresEndEnabled: false,
    };
  }
  return {
    id: slotId,
    label: preset.defaultLabel,
    color: preset.color,
    carParams: {
      ...DEFAULT_CAR_PARAMS,
      carClass: preset.defaultCarClass,
      carId: preset.defaultCarId,
    },
    preSessions: usePresetSamples
      ? JSON.parse(JSON.stringify(DEFAULT_PRE_SESSIONS))
      : clearedPre,
    stintOverrides: usePresetSamples
      ? JSON.parse(JSON.stringify(DEFAULT_STINT_OVERRIDES))
      : clearedOverrides,
    racePreSessions: null,
    raceStintOverrides: null,
    completedItems: {},
  };
}

function normalizeMultiCarPayload(raw) {
  const defaultCar1 = createDefaultCarState('car-1', true);
  if (!raw || typeof raw !== 'object') {
    return {
      version: 2,
      eventConfig: { ...DEFAULT_EVENT_CONFIG },
      carOrder: ['car-1'],
      activeCarId: 'car-1',
      cars: { 'car-1': defaultCar1 },
      eventSignups: {},
    };
  }

  // v2 multi-car format
  if (raw.cars && typeof raw.cars === 'object') {
    const rawOrder = Array.isArray(raw.carOrder)
      ? raw.carOrder.filter((id) => ALL_CAR_SLOT_IDS.includes(id) && raw.cars[id])
      : Object.keys(raw.cars).filter((id) => ALL_CAR_SLOT_IDS.includes(id));
    const carOrder = rawOrder.length > 0 ? rawOrder.slice(0, 3) : ['car-1'];
    const normalizedCars = {};
    carOrder.forEach((id) => {
      const base = createDefaultCarState(id, id === 'car-1');
      const incoming = raw.cars[id] || {};
      normalizedCars[id] = {
        ...base,
        ...incoming,
        id,
        label:
          typeof incoming.label === 'string' && incoming.label.trim()
            ? incoming.label
            : base.label,
        color: incoming.color || base.color,
        carParams: { ...base.carParams, ...(incoming.carParams || {}) },
        preSessions: { ...base.preSessions, ...(incoming.preSessions || {}) },
        stintOverrides: incoming.stintOverrides || base.stintOverrides,
        racePreSessions:
          incoming.racePreSessions !== undefined ? incoming.racePreSessions : null,
        raceStintOverrides:
          incoming.raceStintOverrides !== undefined ? incoming.raceStintOverrides : null,
        completedItems: incoming.completedItems || {},
      };
    });
    const activeCarId = carOrder.includes(raw.activeCarId) ? raw.activeCarId : carOrder[0];
    return {
      version: 2,
      eventConfig: { ...DEFAULT_EVENT_CONFIG, ...(raw.eventConfig || {}) },
      carOrder,
      activeCarId,
      cars: normalizedCars,
      eventSignups: raw.eventSignups || {},
    };
  }

  // Legacy v1 single-car format migration
  const legacyParams = { ...DEFAULT_PARAMS, ...(raw.params || {}) };
  const eventConfig = {
    championship: legacyParams.championship || DEFAULT_EVENT_CONFIG.championship,
    circuitId: legacyParams.circuitId || DEFAULT_EVENT_CONFIG.circuitId,
    sessionStart: legacyParams.sessionStart || DEFAULT_EVENT_CONFIG.sessionStart,
    raceDurationStr: legacyParams.raceDurationStr || DEFAULT_EVENT_CONFIG.raceDurationStr,
    fpDurationMin:
      legacyParams.fpDurationMin !== undefined
        ? legacyParams.fpDurationMin
        : DEFAULT_EVENT_CONFIG.fpDurationMin,
    qualyDurationMin:
      legacyParams.qualyDurationMin !== undefined
        ? legacyParams.qualyDurationMin
        : DEFAULT_EVENT_CONFIG.qualyDurationMin,
  };
  const car1 = {
    ...defaultCar1,
    carParams: {
      carClass: legacyParams.carClass || DEFAULT_CAR_PARAMS.carClass,
      carId: legacyParams.carId || DEFAULT_CAR_PARAMS.carId,
      lapTimeStr: legacyParams.lapTimeStr || DEFAULT_CAR_PARAMS.lapTimeStr,
      tankCapacityL: legacyParams.tankCapacityL || DEFAULT_CAR_PARAMS.tankCapacityL,
      fuelPerLapL: legacyParams.fuelPerLapL || DEFAULT_CAR_PARAMS.fuelPerLapL,
      virtualEnergyPerLapPct:
        legacyParams.virtualEnergyPerLapPct || DEFAULT_CAR_PARAMS.virtualEnergyPerLapPct,
      availableTires:
        legacyParams.availableTires !== undefined
          ? legacyParams.availableTires
          : DEFAULT_CAR_PARAMS.availableTires,
      pitlaneLossSec:
        legacyParams.pitlaneLossSec !== undefined
          ? legacyParams.pitlaneLossSec
          : DEFAULT_CAR_PARAMS.pitlaneLossSec,
    },
    preSessions: { ...DEFAULT_PRE_SESSIONS, ...(raw.preSessions || {}) },
    stintOverrides: raw.stintOverrides || DEFAULT_STINT_OVERRIDES,
    racePreSessions: raw.racePreSessions !== undefined ? raw.racePreSessions : null,
    raceStintOverrides: raw.raceStintOverrides !== undefined ? raw.raceStintOverrides : null,
    completedItems: raw.completedItems || {},
  };

  return {
    version: 2,
    eventConfig,
    carOrder: ['car-1'],
    activeCarId: 'car-1',
    cars: { 'car-1': car1 },
    eventSignups: raw.eventSignups || {},
  };
}

/**
 * Parses lap time string in format MM:SS.mmm, MM:SS, or seconds into total seconds.
 */
function parseLapTimeToSeconds(str) {
  if (!str || typeof str !== 'string') return 105.32;
  const trimmed = str.trim();
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    const mins = parseFloat(parts[0]);
    const secs = parseFloat(parts[1]);
    if (!Number.isNaN(mins) && !Number.isNaN(secs) && mins >= 0 && secs >= 0) {
      const total = mins * 60 + secs;
      return total > 5 ? total : 105.32;
    }
  } else {
    const secs = parseFloat(trimmed);
    if (!Number.isNaN(secs) && secs > 5) return secs;
  }
  return 105.32;
}

/**
 * Parses HH:MM into minutes from midnight.
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr || !timeStr.includes(':')) return 14 * 60;
  const [h, m] = timeStr.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 14 * 60;
  return h * 60 + m;
}

/**
 * Parses HH:MM duration string (e.g. "06:00", "24:00") into total minutes.
 */
function parseDurationHHMMToMinutes(durationStr) {
  if (!durationStr || typeof durationStr !== 'string') return 360;
  const trimmed = durationStr.trim();
  if (trimmed.includes(':')) {
    const [hStr, mStr] = trimmed.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (!Number.isNaN(h) && !Number.isNaN(m) && h >= 0 && m >= 0 && m < 60) {
      const total = h * 60 + m;
      return total > 0 ? total : 360;
    }
  } else {
    const mins = parseInt(trimmed, 10);
    if (!Number.isNaN(mins) && mins > 0) return mins;
  }
  return 360;
}

/**
 * Formats total minutes (may be fractional) into HH:MM (24h wrap).
 */
function formatMinutesToHHMM(totalMinutes) {
  const rounded = Math.round(totalMinutes);
  const wrapped = ((rounded % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Returns tire color classes based on remaining rubber percentage.
 * > 75%: emerald, 50% - 75%: amber, < 50%: red
 */
function getTireBadgeClasses(pct) {
  if (pct > 75) {
    return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 hover:border-emerald-400';
  }
  if (pct >= 50) {
    return 'bg-amber-500/15 text-amber-400 border-amber-500/40 hover:border-amber-400';
  }
  return 'bg-red-500/15 text-red-400 border-red-500/40 hover:border-red-400';
}

function getTireBarColor(pct) {
  if (pct > 75) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

function getTireTextColor(pct) {
  if (pct > 75) return 'text-emerald-400';
  if (pct >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function getTireCountForScenario(scenarioId) {
  switch (scenarioId) {
    case '4_tires_fuel':
      return 4;
    case '2_tires_fuel':
      return 2;
    case 'fuel_only':
    case 'driver_swap_only':
    default:
      return 0;
  }
}

function calculatePitStopDetails({
  scenarioId,
  params,
  carClass,
  nextStintLaps,
  stintLaps,
  remainingFuelL = 0,
  remainingEnergyPct = 0,
  hasDriverSwap = false,
}) {
  const isElms = params.championship === 'ELMS';
  const tankL = Math.max(1, Number(params.tankCapacityL) || 100);
  const fuelPerLap = Math.max(0.1, Number(params.fuelPerLapL) || 3.1);
  const energyPerLap = Math.max(0.1, Number(params.virtualEnergyPerLapPct) || 2.1);

  const targetLaps = Math.max(0, Number(nextStintLaps ?? stintLaps) || 0);
  const needsRefuel = scenarioId !== 'driver_swap_only';

  let neededEnergyPct = 0;
  let neededLiters = 0;
  let deltaEnergyPct = 0;
  let deltaLiters = 0;
  let refuelSec = 0;

  if (needsRefuel && targetLaps > 0) {
    if (isElms) {
      neededLiters = Math.min(tankL, Math.max(0, targetLaps * fuelPerLap));
      deltaLiters = Math.min(tankL, Math.max(0, neededLiters - Math.max(0, remainingFuelL)));
      refuelSec = deltaLiters > 0 ? deltaLiters / 2.5 + 3 : 0;
    } else {
      neededEnergyPct = Math.min(100, Math.max(0, targetLaps * energyPerLap));
      neededLiters = Math.min(tankL, Math.max(0, targetLaps * fuelPerLap));
      deltaEnergyPct = Math.min(100, Math.max(0, neededEnergyPct - Math.max(0, remainingEnergyPct)));
      deltaLiters = Math.min(tankL, Math.max(0, neededLiters - Math.max(0, remainingFuelL)));
      refuelSec = deltaEnergyPct > 0 ? deltaEnergyPct / 2.5 + 3 : 0;
    }
  }

  const tiresCount = getTireCountForScenario(scenarioId);
  const perTireSec = carClass === 'LMGT3' || carClass === 'GTE' ? 8.5 : 8.0;
  const tireSec = tiresCount * perTireSec;

  const swapActive = Boolean(hasDriverSwap) || scenarioId === 'driver_swap_only';
  const baseWithSwapSec = swapActive ? Math.max(refuelSec, 25) : refuelSec;

  const stationarySec = Math.round((baseWithSwapSec + tireSec) * 10) / 10;
  const pitlaneLossSec = Math.max(0, Number(params.pitlaneLossSec) || 0);
  const totalSec = Math.round((stationarySec + pitlaneLossSec) * 10) / 10;

  const deltaEnergyRounded = Math.round(deltaEnergyPct);
  const deltaLitersRounded = Math.round(deltaLiters);
  const mfdTargetLabel =
    !needsRefuel || (isElms ? deltaLitersRounded <= 0 : deltaEnergyRounded <= 0 && deltaLitersRounded <= 0)
      ? 'Sem abastec.'
      : isElms
      ? `+${deltaLitersRounded}L`
      : `+${deltaEnergyRounded}% E (${deltaLitersRounded}L)`;

  return {
    stationarySec,
    pitlaneLossSec,
    totalSec,
    refuelSec: Math.round(refuelSec * 10) / 10,
    tireSec,
    tiresCount,
    swapActive,
    deltaEnergyPct: deltaEnergyRounded,
    deltaLiters: deltaLitersRounded,
    neededEnergyPct: Math.round(neededEnergyPct),
    neededLiters: Math.round(neededLiters),
    mfdTargetLabel,
  };
}

function computeCarTelemetry(eventConfig, carParams) {
  const isElms = eventConfig.championship === 'ELMS';
  const lapTimeSec = parseLapTimeToSeconds(carParams.lapTimeStr);
  const tankL = Math.max(1, Number(carParams.tankCapacityL) || 100);
  const fuelPerLap = Math.max(0.1, Number(carParams.fuelPerLapL) || 3.1);
  const energyPerLap = Math.max(0.1, Number(carParams.virtualEnergyPerLapPct) || 2.1);

  const fuelRatio = isElms ? null : fuelPerLap / energyPerLap;
  const maxLapsByFuel = Math.floor(tankL / fuelPerLap);
  const maxLapsByEnergy = isElms ? maxLapsByFuel : Math.floor(100 / energyPerLap);
  const maxStintLaps = Math.max(
    1,
    isElms ? maxLapsByFuel : Math.min(maxLapsByFuel, maxLapsByEnergy)
  );
  const limitingFactor = isElms
    ? 'Tanque (ELMS)'
    : maxLapsByFuel <= maxLapsByEnergy
    ? 'Tanque'
    : 'Energia Virtual';
  const maxStintMin = (maxStintLaps * lapTimeSec) / 60;

  return {
    isElms,
    lapTimeSec,
    fuelRatio,
    maxLapsByFuel,
    maxLapsByEnergy,
    maxStintLaps,
    limitingFactor,
    maxStintMin,
  };
}

function computeCarSchedule({ eventConfig, car, stintMode, telemetry }) {
  const combinedParams = { ...eventConfig, ...car.carParams };
  const planPre = car.preSessions || DEFAULT_PRE_SESSIONS;
  const planOverrides = car.stintOverrides || DEFAULT_STINT_OVERRIDES;
  const activePre =
    stintMode === 'race' ? car.racePreSessions || planPre : planPre;
  const activeOverrides =
    stintMode === 'race' ? car.raceStintOverrides || planOverrides : planOverrides;

  const rows = [];
  let cursorMin = parseTimeToMinutes(eventConfig.sessionStart);

  const fpDur = Math.max(0, Number(eventConfig.fpDurationMin) || 0);
  const fpLaps = Math.floor((fpDur * 60) / telemetry.lapTimeSec);
  rows.push({
    id: 'fp',
    type: 'fp',
    label: 'Free Practice',
    durationMin: fpDur,
    laps: fpLaps,
    startMin: cursorMin,
    endMin: cursorMin + fpDur,
    driver: activePre.fp?.driver || 'ND',
    pitScenario: null,
    pitDurationSec: 0,
    pitStationarySec: 0,
    pitlaneLossSec: 0,
    tiresStart: DEFAULT_FULL_TIRES,
    tiresEnd: DEFAULT_FULL_TIRES,
  });
  cursorMin += fpDur;

  const qualyDur = Math.max(0, Number(eventConfig.qualyDurationMin) || 0);
  const qualyLaps = Math.floor((qualyDur * 60) / telemetry.lapTimeSec);
  rows.push({
    id: 'qualy',
    type: 'qualy',
    label: 'Qualy',
    durationMin: qualyDur,
    laps: qualyLaps,
    startMin: cursorMin,
    endMin: cursorMin + qualyDur,
    driver: activePre.qualy?.driver || 'ND',
    plannedDriver: planPre.qualy?.driver || 'ND',
    pitScenario: null,
    pitDurationSec: 0,
    pitStationarySec: 0,
    pitlaneLossSec: 0,
    tiresStart: activePre.qualy?.tiresStart || DEFAULT_FULL_TIRES,
    tiresEnd:
      activePre.qualy?.tiresEnd ||
      activePre.qualy?.tires || { FL: 88, FR: 84, RL: 90, RR: 89 },
    tiresEndEnabled: Boolean(activePre.qualy?.tiresEndEnabled),
  });
  cursorMin += qualyDur;

  const totalRaceMin = parseDurationHHMMToMinutes(eventConfig.raceDurationStr);
  const tankCapacityL = Math.max(1, Number(combinedParams.tankCapacityL) || 100);
  const fuelPerLapL = Math.max(0.1, Number(combinedParams.fuelPerLapL) || 3.1);
  const energyPerLapPct = Math.max(0.1, Number(combinedParams.virtualEnergyPerLapPct) || 2.1);

  let remainingRaceMin = totalRaceMin;
  let currentTankL = tankCapacityL;
  let currentEnergyPct = telemetry.isElms ? 0 : 100;
  let stintNum = 1;
  const maxStintsGuard = 60;

  while (remainingRaceMin > 0.05 && stintNum <= maxStintsGuard) {
    const override = activeOverrides[stintNum] || {};
    const plannedOverride = planOverrides[stintNum] || {};
    const defaultDriver = DRIVERS[(stintNum - 1) % Math.min(6, DRIVERS.length)];
    const driver = override.driver || defaultDriver;
    const plannedDriver = plannedOverride.driver || defaultDriver;
    const pitScenario = override.pitScenario || '4_tires_fuel';
    const tiresStart = override.tiresStart || DEFAULT_FULL_TIRES;
    const tiresEnd = override.tiresEnd || override.tires || { FL: 72, FR: 68, RL: 76, RR: 74 };
    const tiresEndEnabled = Boolean(override.tiresEndEnabled);

    const hasCustomDuration =
      override.durationMinOverride !== undefined &&
      override.durationMinOverride !== null &&
      !Number.isNaN(Number(override.durationMinOverride));
    const rawStintMin = hasCustomDuration
      ? Math.min(remainingRaceMin, Math.max(1, Number(override.durationMinOverride)))
      : Math.min(telemetry.maxStintMin, remainingRaceMin);
    const stintLaps = Math.max(1, Math.round((rawStintMin * 60) / telemetry.lapTimeSec));
    const startMin = cursorMin;
    const endMin = startMin + rawStintMin;

    const isLastStint = remainingRaceMin - rawStintMin <= 0.05;
    const nextOverride = activeOverrides[stintNum + 1] || {};
    const nextDefaultDriver = DRIVERS[stintNum % Math.min(6, DRIVERS.length)];
    const nextDriver = nextOverride.driver || nextDefaultDriver;
    const hasDriverSwap =
      Boolean(driver) &&
      Boolean(nextDriver) &&
      driver !== 'ND' &&
      nextDriver !== 'ND' &&
      driver !== nextDriver;

    // Fuel / energy remaining upon entering the box at the end of Stint i
    const remainingFuelL = Math.max(0, currentTankL - stintLaps * fuelPerLapL);
    const remainingEnergyPct = telemetry.isElms
      ? 0
      : Math.max(0, currentEnergyPct - stintLaps * energyPerLapPct);

    let pitDetails = {
      stationarySec: 0,
      pitlaneLossSec: 0,
      totalSec: 0,
      refuelSec: 0,
      tireSec: 0,
      tiresCount: 0,
      swapActive: false,
      deltaEnergyPct: 0,
      deltaLiters: 0,
      neededEnergyPct: 0,
      neededLiters: 0,
      mfdTargetLabel: '',
    };
    let nextStintLaps = 0;

    if (!isLastStint) {
      const remainingAfterCurrentMin = Math.max(0, remainingRaceMin - rawStintMin);
      const hasNextCustomDuration =
        nextOverride.durationMinOverride !== undefined &&
        nextOverride.durationMinOverride !== null &&
        !Number.isNaN(Number(nextOverride.durationMinOverride));

      // 2-pass convergence so pit duration & next stint demand match cleanly
      let estPitMin = 0.75;
      for (let pass = 0; pass < 2; pass += 1) {
        const remForNextMin = Math.max(0.05, remainingAfterCurrentMin - estPitMin);
        const rawNextMin = hasNextCustomDuration
          ? Math.min(remForNextMin, Math.max(1, Number(nextOverride.durationMinOverride)))
          : Math.min(telemetry.maxStintMin, remForNextMin);
        const isNextLastStint = remForNextMin - rawNextMin <= 0.05;
        const baseNextLaps = Math.max(
          1,
          Math.ceil((rawNextMin * 60) / telemetry.lapTimeSec)
        );
        nextStintLaps = baseNextLaps + (isNextLastStint ? 1 : 0);

        pitDetails = calculatePitStopDetails({
          scenarioId: pitScenario,
          params: combinedParams,
          carClass: combinedParams.carClass || 'LMGT3',
          nextStintLaps,
          remainingFuelL,
          remainingEnergyPct,
          hasDriverSwap,
        });
        estPitMin = pitDetails.totalSec / 60;
      }
    }

    const pitDurationSec = pitDetails.totalSec;
    const pitDurationMin = pitDurationSec / 60;

    rows.push({
      id: `stint_${stintNum}`,
      type: 'race',
      stintNum,
      label: `Stint ${String(stintNum).padStart(2, '0')}`,
      durationMin: rawStintMin,
      isDurationOverridden: hasCustomDuration,
      laps: stintLaps,
      startMin,
      endMin,
      driver,
      plannedDriver,
      pitScenario,
      pitDurationSec,
      pitStationarySec: pitDetails.stationarySec,
      pitlaneLossSec: pitDetails.pitlaneLossSec,
      deltaEnergyPct: pitDetails.deltaEnergyPct,
      deltaLiters: pitDetails.deltaLiters,
      mfdTargetLabel: pitDetails.mfdTargetLabel,
      nextStintLaps,
      remainingFuelL,
      remainingEnergyPct,
      hasDriverSwap,
      isLastStint,
      tiresStart,
      tiresEnd,
      tiresEndEnabled,
    });

    remainingRaceMin -= rawStintMin;
    if (!isLastStint) {
      cursorMin = endMin + pitDurationMin;
      remainingRaceMin = Math.max(0, remainingRaceMin - pitDurationMin);
      currentTankL = Math.min(tankCapacityL, remainingFuelL + pitDetails.deltaLiters);
      currentEnergyPct = telemetry.isElms
        ? 0
        : Math.min(100, remainingEnergyPct + pitDetails.deltaEnergyPct);
    } else {
      cursorMin = endMin;
    }

    stintNum += 1;
  }

  return rows;
}

function StartTireToggleButton({ corner, tireMeta, stintMode = 'race', onToggle }) {
  const mode = tireMeta?.mode || 'new';
  const tireId = stintMode === 'planning' ? '' : tireMeta?.tireId || '';
  const pct = tireMeta?.pct;
  const sourceLabel = tireMeta?.sourceLabel;
  const isWet = mode === 'wet' || (mode === 'keep' && Boolean(tireMeta?.isWet));

  let displayValue = 'SECO';
  if (mode === 'wet') {
    displayValue = 'CHUVA';
  } else if (stintMode === 'planning') {
    if (mode === 'keep') displayValue = 'MANTER';
    else if (mode === 'used') displayValue = 'USADO';
  } else {
    if (mode === 'keep') {
      displayValue = pct === 'ND' || pct === null || pct === undefined ? 'MANTER' : `MANT ${pct}%`;
    } else if (mode === 'used') {
      displayValue = pct === 'ND' || pct === null || pct === undefined ? 'ND' : `${pct}%`;
    }
  }

  const colorClasses =
    mode === 'wet'
      ? 'bg-blue-500/20 text-sky-300 border-blue-400/50 hover:border-sky-300 hover:bg-blue-500/30'
      : mode === 'new'
      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 hover:border-emerald-400 hover:bg-emerald-500/25'
      : mode === 'keep'
        ? isWet
          ? 'bg-blue-500/5 text-sky-300/75 border-blue-400/25 opacity-60 hover:opacity-90 hover:border-sky-300/60'
          : 'bg-emerald-500/5 text-emerald-400/75 border-emerald-500/25 opacity-60 hover:opacity-90 hover:border-emerald-400/60'
        : 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:border-amber-400 hover:bg-amber-500/25';

  const tooltip =
    mode === 'wet'
      ? `Pneu ${corner} (CHUVA — sem limite, não contabilizado no banco)`
      : stintMode === 'planning'
      ? `Pneu ${corner} (${displayValue}) — Clique para alternar (SECO / MANTER / USADO / CHUVA)`
      : mode === 'new'
        ? `Pneu ${corner} ${tireId} (SECO) — Clique para alternar (Manter / Usado / Chuva)`
        : mode === 'keep'
          ? `Pneu ${corner} ${tireId} (MANTIDO ${isWet ? 'CHUVA' : 'SECO'} de ${sourceLabel || 'stint anterior'}${pct && pct !== 'ND' ? ` • ${pct}%` : ''}) — Clique para alternar`
          : `Pneu ${corner} ${tireId} (USADO SECO • ${sourceLabel ? `${displayValue} de ${sourceLabel}` : displayValue}) — Clique para alternar para CHUVA`;

  return (
    <button
      type="button"
      onClick={onToggle}
      title={tooltip}
      className={`flex w-full flex-col items-center justify-center rounded-md border px-2 py-1.5 text-xs font-mono font-semibold transition-all cursor-pointer min-w-[58px] ${colorClasses}`}
    >
      <span className="text-[10px] uppercase tracking-wider opacity-90 leading-none">
        {corner}{tireId ? ` ${tireId}` : ''}
      </span>
      <span className="inline-flex items-center gap-1 tabular-nums leading-tight mt-1 text-[11px] font-bold">
        {isWet ? (
          <Droplets className="h-3 w-3 shrink-0 text-sky-300" />
        ) : (
          <Sun className="h-3 w-3 shrink-0 text-amber-300" />
        )}
        {displayValue}
      </span>
    </button>
  );
}

function TireBadgeEditor({ corner, tireId, value, onChange }) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const numericVal = Math.min(100, Math.max(0, Number(value) || 0));

  return (
    <div className="relative flex flex-col" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title={`Editar desgaste ${corner} ${tireId || ''} (${numericVal}%)`}
        className={`flex w-full flex-col items-center justify-center rounded-md border px-2 py-1.5 text-xs font-mono font-semibold transition-all cursor-pointer min-w-[58px] ${getTireBadgeClasses(
          numericVal
        )}`}
      >
        <span className="text-[10px] uppercase tracking-wider opacity-90 leading-none">
          {corner} {tireId || ''}
        </span>
        <span className="tabular-nums leading-tight mt-1 text-[11px] font-bold">{numericVal}%</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-1.5 sm:block sm:bg-transparent sm:p-0"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-64 sm:w-48 rounded-xl sm:rounded-lg border border-slate-600 bg-slate-900 p-4 sm:p-3 shadow-2xl">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-200">
              <span>
                Pneu {corner} {tireId || ''}
              </span>
              <div className="flex items-center gap-2">
                <span className={`font-mono tabular-nums ${getTireTextColor(numericVal)}`}>
                  {numericVal}%
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="sm:hidden text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={numericVal}
              onChange={(e) => onChange(Number(e.target.value))}
              className="mb-3 sm:mb-2 w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="0"
                max="100"
                value={numericVal}
                onChange={(e) => {
                  const v = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                  onChange(v);
                }}
                className="w-16 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs font-mono text-slate-100 focus:border-amber-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  onChange(100);
                  setOpen(false);
                }}
                className="flex-1 rounded bg-emerald-500/20 border border-emerald-500/40 px-2 py-1 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/30 transition-colors"
              >
                NOVO (100%)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function loadInitialStrategyState() {
  const fallback = {
    ...normalizeMultiCarPayload(null),
    loadedFromUrl: false,
  };

  try {
    const searchParams = new URLSearchParams(window.location.search);
    const encodedState = searchParams.get('s');
    if (encodedState) {
      const decompressed = LZString.decompressFromEncodedURIComponent(encodedState);
      if (decompressed) {
        const parsed = JSON.parse(decompressed);
        if (parsed && typeof parsed === 'object') {
          const merged = normalizeMultiCarPayload(parsed);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          window.history.replaceState({}, '', window.location.pathname);
          return { ...merged, loadedFromUrl: true };
        }
      }
    }
  } catch {
    // ignore malformed URL state and fall back to localStorage
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        return {
          ...normalizeMultiCarPayload(parsed),
          loadedFromUrl: false,
        };
      }
    }
  } catch {
    // ignore storage errors
  }

  return fallback;
}

function StintModeToggleSwitch({ mode, onToggle, compact = false }) {
  const isRace = mode === 'race';
  return (
    <button
      type="button"
      onClick={onToggle}
      title="Clique para alternar entre Modo Planejamento e Modo Corrida"
      className={`relative inline-grid grid-cols-2 items-center rounded-full border border-[#334155] bg-[#0f172a] p-0.5 shadow-inner cursor-pointer select-none ${
        compact ? 'text-[9px]' : 'text-[10px]'
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-full border transition-all duration-200 ${
          isRace
            ? 'left-[calc(50%+1px)] border-emerald-400/60 bg-emerald-500/20 shadow-[0_0_10px_rgba(34,197,94,0.25)]'
            : 'left-0.5 border-indigo-400/60 bg-indigo-500/25 shadow-[0_0_10px_rgba(99,102,241,0.25)]'
        }`}
      />
      <span
        className={`relative z-10 text-center font-bold uppercase tracking-wider transition-colors ${
          compact ? 'px-2 py-0.5' : 'px-2.5 py-1'
        } ${!isRace ? 'text-indigo-200' : 'text-slate-400'}`}
      >
        Plano
      </span>
      <span
        className={`relative z-10 text-center font-bold uppercase tracking-wider transition-colors ${
          compact ? 'px-2 py-0.5' : 'px-2.5 py-1'
        } ${isRace ? 'text-emerald-200' : 'text-slate-400'}`}
      >
        Corrida
      </span>
    </button>
  );
}

function CheckeredStripButton({ done, onToggle, title = 'Marcar como concluído', roundedClass = '' }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      title={done ? 'Concluído (clique para desmarcar)' : title}
      aria-pressed={done}
      className={`w-4 shrink-0 self-stretch border-l border-[#334155]/80 transition-all cursor-pointer flex items-center justify-center ${roundedClass} ${
        done ? 'opacity-95' : 'bg-[#0f172a]/50 hover:bg-slate-700/60'
      }`}
      style={
        done
          ? {
              backgroundImage:
                'linear-gradient(45deg, #f8fafc 25%, transparent 25%), linear-gradient(-45deg, #f8fafc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f8fafc 75%), linear-gradient(-45deg, transparent 75%, #f8fafc 75%)',
              backgroundSize: '8px 8px',
              backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
              backgroundColor: '#0f172a',
            }
          : undefined
      }
    >
      {!done && <span className="h-3 w-0.5 rounded-full bg-slate-600/80" />}
    </button>
  );
}

const FreeNumericInput = React.forwardRef(function FreeNumericInput(
  { value, onCommit, min = 0, allowDecimal = true, className = '', placeholder = '', ...rest },
  ref
) {
  const [isFocused, setIsFocused] = useState(false);
  const [draft, setDraft] = useState(() =>
    value === undefined || value === null ? '' : String(value)
  );

  useEffect(() => {
    if (!isFocused) {
      setDraft(value === undefined || value === null ? '' : String(value));
    }
  }, [value, isFocused]);

  const handleChange = (e) => {
    const raw = e.target.value;
    if (allowDecimal) {
      if (/^[0-9]*[.,]?[0-9]*$/.test(raw)) {
        setDraft(raw);
      }
    } else if (/^[0-9]*$/.test(raw)) {
      setDraft(raw);
    }
  };

  const commit = () => {
    const cleaned = draft.trim().replace(',', '.');
    if (cleaned === '' || cleaned === '.') {
      setDraft(String(min));
      onCommit(min);
      return;
    }
    const parsed = Number(cleaned);
    if (Number.isNaN(parsed)) {
      setDraft(String(min));
      onCommit(min);
      return;
    }
    const clamped = Math.max(min, allowDecimal ? parsed : Math.round(parsed));
    setDraft(String(clamped));
    onCommit(clamped);
  };

  return (
    <input
      ref={ref}
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      value={isFocused ? draft : value === undefined || value === null ? '' : String(value)}
      placeholder={placeholder}
      onFocus={() => {
        setIsFocused(true);
        setDraft(value === undefined || value === null ? '' : String(value));
      }}
      onChange={handleChange}
      onBlur={() => {
        setIsFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
      }}
      className={className}
      {...rest}
    />
  );
});

function normalizeRaceDurationStr(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '06:00';
  if (trimmed.includes(':')) {
    const [hRaw, mRaw] = trimmed.split(':');
    const h = Math.max(0, parseInt(hRaw, 10) || 0);
    const m = Math.min(59, Math.max(0, parseInt(mRaw, 10) || 0));
    if (h === 0 && m === 0) return '00:10';
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '06:00';
  if (digits.length <= 2) {
    const h = Math.max(0, parseInt(digits, 10) || 0);
    if (h === 0) return '00:10';
    return `${String(h).padStart(2, '0')}:00`;
  }
  const h = parseInt(digits.slice(0, -2), 10) || 0;
  const m = Math.min(59, parseInt(digits.slice(-2), 10) || 0);
  if (h === 0 && m === 0) return '00:10';
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function normalizeLapTimeStr(raw) {
  const trimmed = (raw || '').trim().replace(',', '.');
  if (!trimmed) return '01:45.320';
  const totalSec = parseLapTimeToSeconds(trimmed);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec - mins * 60;
  const wholeSecs = Math.floor(secs);
  const ms = Math.round((secs - wholeSecs) * 1000);
  return `${String(mins).padStart(2, '0')}:${String(wholeSecs).padStart(2, '0')}.${String(
    ms
  ).padStart(3, '0')}`;
}

function FreeFormattedTextInput({
  value,
  onCommit,
  normalize,
  placeholder = '',
  className = '',
  inputMode = 'text',
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [draft, setDraft] = useState(() => value || '');

  useEffect(() => {
    if (!isFocused) {
      setDraft(value || '');
    }
  }, [value, isFocused]);

  return (
    <input
      type="text"
      inputMode={inputMode}
      placeholder={placeholder}
      value={isFocused ? draft : value || ''}
      onFocus={() => {
        setIsFocused(true);
        setDraft(value || '');
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setIsFocused(false);
        const normalized = normalize ? normalize(draft) : draft.trim();
        setDraft(normalized);
        onCommit(normalized);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
      }}
      className={className}
    />
  );
}

export default function App() {
  const initialStateRef = useRef(null);
  if (!initialStateRef.current) {
    initialStateRef.current = loadInitialStrategyState();
  }

  const [eventConfig, setEventConfig] = useState(() => initialStateRef.current.eventConfig);
  const [carOrder, setCarOrder] = useState(() => initialStateRef.current.carOrder);
  const [activeCarId, setActiveCarId] = useState(() => initialStateRef.current.activeCarId);
  const [cars, setCars] = useState(() => initialStateRef.current.cars);
  const [eventSignups, setEventSignups] = useState(
    () => initialStateRef.current.eventSignups || {}
  );

  const activeCar = useMemo(
    () => cars[activeCarId] || cars[carOrder[0]] || createDefaultCarState('car-1', true),
    [cars, activeCarId, carOrder]
  );

  const params = useMemo(
    () => ({
      ...DEFAULT_EVENT_CONFIG,
      ...eventConfig,
      ...DEFAULT_CAR_PARAMS,
      ...(activeCar?.carParams || {}),
    }),
    [eventConfig, activeCar]
  );

  const preSessions = activeCar?.preSessions || DEFAULT_PRE_SESSIONS;
  const stintOverrides = activeCar?.stintOverrides || DEFAULT_STINT_OVERRIDES;
  const racePreSessions = activeCar?.racePreSessions ?? null;
  const raceStintOverrides = activeCar?.raceStintOverrides ?? null;
  const completedItems = activeCar?.completedItems || {};

  const updateActiveCar = (updater) => {
    setCars((prev) => {
      const targetId = prev[activeCarId] ? activeCarId : carOrder[0];
      const currentCar = prev[targetId];
      if (!currentCar) return prev;
      return {
        ...prev,
        [targetId]: typeof updater === 'function' ? updater(currentCar) : { ...currentCar, ...updater },
      };
    });
  };

  const setParams = (updater) => {
    const nextMerged = typeof updater === 'function' ? updater(params) : updater;
    const nextGlobal = {};
    const nextCar = {};
    Object.keys(nextMerged).forEach((k) => {
      if (GLOBAL_PARAM_KEYS.has(k)) {
        nextGlobal[k] = nextMerged[k];
      } else {
        nextCar[k] = nextMerged[k];
      }
    });
    setEventConfig((prev) => ({ ...prev, ...nextGlobal }));
    updateActiveCar((car) => ({
      ...car,
      carParams: { ...car.carParams, ...nextCar },
    }));
  };

  const setPreSessions = (updater) => {
    updateActiveCar((car) => ({
      ...car,
      preSessions: typeof updater === 'function' ? updater(car.preSessions || DEFAULT_PRE_SESSIONS) : updater,
    }));
  };

  const setStintOverrides = (updater) => {
    updateActiveCar((car) => ({
      ...car,
      stintOverrides: typeof updater === 'function' ? updater(car.stintOverrides || DEFAULT_STINT_OVERRIDES) : updater,
    }));
  };

  const setRacePreSessions = (updater) => {
    updateActiveCar((car) => ({
      ...car,
      racePreSessions: typeof updater === 'function' ? updater(car.racePreSessions) : updater,
    }));
  };

  const setRaceStintOverrides = (updater) => {
    updateActiveCar((car) => ({
      ...car,
      raceStintOverrides: typeof updater === 'function' ? updater(car.raceStintOverrides) : updater,
    }));
  };

  const setCompletedItems = (updater) => {
    updateActiveCar((car) => ({
      ...car,
      completedItems: typeof updater === 'function' ? updater(car.completedItems || {}) : updater,
    }));
  };

  const [copied, setCopied] = useState(false);
  const [mobileParamsOpen, setMobileParamsOpen] = useState(true);
  const [mobileFuelOpen, setMobileFuelOpen] = useState(true);
  const [mobilePage, setMobilePage] = useState(1);
  const prevMobilePageRef = useRef(1);
  const mobilePagerRef = useRef(null);
  const mobilePagerInitRef = useRef(false);
  const mobileSessionStartRef = useRef(null);
  const mobileAvailableTiresRef = useRef(null);
  const mobileCarTrackRef = useRef(null);
  const mobileCalendarRef = useRef(null);
  const desktopCalendarRef = useRef(null);
  const [selectedTireCornerModal, setSelectedTireCornerModal] = useState(null);
  const [circuitModalOpen, setCircuitModalOpen] = useState(false);
  const [overviewModalOpen, setOverviewModalOpen] = useState(false);
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [calendarEventModal, setCalendarEventModal] = useState(null);
  const [signupDriverDraft, setSignupDriverDraft] = useState(() => DRIVERS[0]);
  const [signupClassesDraft, setSignupClassesDraft] = useState(['Hypercar']);
  const [headerEventIdx, setHeaderEventIdx] = useState(0);
  const [expandedStintId, setExpandedStintId] = useState(null);
  const [stintMode, setStintMode] = useState('planning'); // 'planning' | 'race'
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [tirePitModalRowId, setTirePitModalRowId] = useState(null);
  const [toast, setToast] = useState(() =>
    initialStateRef.current.loadedFromUrl
      ? { message: 'Estratégia carregada pelo link compartilhado!', type: 'success' }
      : null
  );

  const [roomPin, setRoomPin] = useState(() => {
    try {
      return localStorage.getItem(ROOM_PIN_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [pinDraft, setPinDraft] = useState(roomPin);
  const [liveRoomEnabled, setLiveRoomEnabled] = useState(() => Boolean(roomPin.trim()));
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState('local'); // 'local' | 'connecting' | 'live' | 'error'
  const [livePeersCount, setLivePeersCount] = useState(1);
  const isPinLocked = !roomPin.trim() || !liveRoomEnabled;

  const isApplyingRemoteRef = useRef(false);
  const syncTimeoutRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (initialStateRef.current?.loadedFromUrl) {
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, []);

  const buildMultiCarPayload = () => ({
    version: 2,
    eventConfig,
    carOrder,
    activeCarId,
    cars,
    eventSignups,
  });

  const applyNormalizedState = (normalized, preserveActiveCar = false) => {
    setEventConfig(normalized.eventConfig);
    setCarOrder(normalized.carOrder);
    setCars(normalized.cars);
    setActiveCarId((prevActive) =>
      preserveActiveCar && normalized.carOrder.includes(prevActive)
        ? prevActive
        : normalized.activeCarId
    );
    if (normalized.eventSignups) {
      setEventSignups(normalized.eventSignups);
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: 2,
          eventConfig,
          carOrder,
          activeCarId,
          cars,
          eventSignups,
        })
      );
    } catch {
      // ignore quota errors
    }
    try {
      localStorage.setItem(EVENT_SIGNUPS_STORAGE_KEY, JSON.stringify(eventSignups));
    } catch {
      // ignore quota errors
    }
  }, [eventConfig, carOrder, activeCarId, cars, eventSignups]);

  // Supabase Realtime Subscription (when configured and live room enabled)
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !liveRoomEnabled || !roomPin.trim()) {
      setSyncStatus('local');
      setLivePeersCount(1);
      return;
    }

    const activePin = roomPin.trim().toUpperCase();
    let cancelled = false;
    setSyncStatus('connecting');

    async function initRoom() {
      try {
        const { data, error } = await supabase
          .from('race_strategies')
          .select('strategy_data, updated_by')
          .eq('room_pin', activePin)
          .maybeSingle();

        if (cancelled) return;
        if (error) {
          setSyncStatus('error');
          showToast('Erro ao conectar na sala ao vivo. Usando Modo Local.', 'error');
          return;
        }

        if (data?.strategy_data) {
          isApplyingRemoteRef.current = true;
          const normalized = normalizeMultiCarPayload(data.strategy_data);
          applyNormalizedState(normalized, true);
          setTimeout(() => {
            isApplyingRemoteRef.current = false;
          }, 50);
        } else {
          await supabase.from('race_strategies').upsert(
            {
              room_pin: activePin,
              strategy_data: buildMultiCarPayload(),
              updated_by: CLIENT_INSTANCE_ID,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'room_pin' }
          );
        }
      } catch {
        if (!cancelled) setSyncStatus('error');
      }
    }

    initRoom();

    const channel = supabase
      .channel(`pitwall-room-${activePin}`, {
        config: {
          presence: {
            key: CLIENT_INSTANCE_ID,
          },
        },
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'race_strategies',
          filter: `room_pin=eq.${activePin}`,
        },
        (payload) => {
          const record = payload.new;
          if (!record?.strategy_data || record.updated_by === CLIENT_INSTANCE_ID) return;
          isApplyingRemoteRef.current = true;
          const normalized = normalizeMultiCarPayload(record.strategy_data);
          applyNormalizedState(normalized, true);
          setTimeout(() => {
            isApplyingRemoteRef.current = false;
          }, 50);
        }
      )
      .on('presence', { event: 'sync' }, () => {
        if (cancelled) return;
        const state = channel.presenceState();
        setLivePeersCount(Math.max(1, Object.keys(state).length));
      })
      .subscribe(async (status) => {
        if (cancelled) return;
        if (status === 'SUBSCRIBED') {
          setSyncStatus('live');
          try {
            await channel.track({ online_at: new Date().toISOString() });
          } catch {
            // Ignore presence track errors
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setSyncStatus('error');
        }
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [liveRoomEnabled, roomPin]);

  // Debounced push of local edits to Supabase when live room is active
  useEffect(() => {
    if (
      !isSupabaseConfigured ||
      !supabase ||
      !liveRoomEnabled ||
      syncStatus !== 'live' ||
      isApplyingRemoteRef.current
    ) {
      return;
    }

    const activePin = roomPin.trim().toUpperCase();
    if (!activePin) return;

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(async () => {
      try {
        await supabase.from('race_strategies').upsert(
          {
            room_pin: activePin,
            strategy_data: buildMultiCarPayload(),
            updated_by: CLIENT_INSTANCE_ID,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'room_pin' }
        );
      } catch {
        // Keep local state intact on transient network failure
      }
    }, 400);

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [
    eventConfig,
    carOrder,
    activeCarId,
    cars,
    eventSignups,
    liveRoomEnabled,
    syncStatus,
    roomPin,
  ]);

  const handleParamChange = (key, value) => {
    if (GLOBAL_PARAM_KEYS.has(key)) {
      setEventConfig((prev) => ({ ...prev, [key]: value }));
    } else {
      updateActiveCar((car) => ({
        ...car,
        carParams: { ...car.carParams, [key]: value },
      }));
    }
  };

  const handleUpdateCarLabel = (slotId, nextLabel) => {
    setCars((prev) => {
      const target = prev[slotId];
      if (!target) return prev;
      return {
        ...prev,
        [slotId]: { ...target, label: nextLabel },
      };
    });
  };

  const handleAddCar = () => {
    if (carOrder.length >= 3) {
      showToast('Limite máximo de 3 carros simultâneos atingido.', 'warning');
      return;
    }
    const nextSlot = ALL_CAR_SLOT_IDS.find((id) => !carOrder.includes(id));
    if (!nextSlot) return;
    const newCar = createDefaultCarState(nextSlot, false);
    setCars((prev) => ({ ...prev, [nextSlot]: newCar }));
    setCarOrder((prev) => [...prev, nextSlot]);
    setActiveCarId(nextSlot);
    showToast(`${newCar.label} adicionado ao painel!`, 'success');
  };

  const handleRemoveCar = (slotId) => {
    if (carOrder.length <= 1) {
      showToast('Pelo menos 1 carro deve permanecer ativo.', 'warning');
      return;
    }
    const targetCar = cars[slotId];
    setConfirmDialog({
      title: `Remover ${targetCar?.label || slotId}`,
      message: `Deseja remover o carro "${targetCar?.label || slotId}" desta corrida? Os stints e configurações dele serão excluídos.`,
      confirmLabel: 'Remover Carro',
      tone: 'red',
      onConfirm: () => {
        const nextOrder = carOrder.filter((id) => id !== slotId);
        setCarOrder(nextOrder);
        setCars((prev) => {
          const copy = { ...prev };
          delete copy[slotId];
          return copy;
        });
        if (activeCarId === slotId) {
          setActiveCarId(nextOrder[0]);
        }
        showToast(`${targetCar?.label || slotId} removido.`, 'warning');
      },
    });
  };

  const handleCloneCarStrategy = (targetCarId) => {
    if (!targetCarId || targetCarId === activeCarId || !cars[targetCarId]) return;
    const sourceCar = activeCar;
    const targetCar = cars[targetCarId];
    setCars((prev) => ({
      ...prev,
      [targetCarId]: {
        ...prev[targetCarId],
        carParams: JSON.parse(JSON.stringify(sourceCar.carParams)),
        preSessions: JSON.parse(JSON.stringify(sourceCar.preSessions)),
        stintOverrides: JSON.parse(JSON.stringify(sourceCar.stintOverrides)),
        racePreSessions: sourceCar.racePreSessions
          ? JSON.parse(JSON.stringify(sourceCar.racePreSessions))
          : null,
        raceStintOverrides: sourceCar.raceStintOverrides
          ? JSON.parse(JSON.stringify(sourceCar.raceStintOverrides))
          : null,
      },
    }));
    setCloneModalOpen(false);
    showToast(
      `Estratégia de "${sourceCar.label}" copiada para "${targetCar.label}"!`,
      'success'
    );
  };

  const buildClearedSessions = () => {
    const clearedPre = {
      fp: {
        driver: 'ND',
        tiresStart: { ...DEFAULT_FULL_TIRES },
        tiresEnd: { ...DEFAULT_FULL_TIRES },
      },
      qualy: {
        driver: 'ND',
        tiresStart: { ...DEFAULT_FULL_TIRES },
        tiresEnd: { ...DEFAULT_FULL_TIRES },
        tiresEndEnabled: false,
      },
    };
    const clearedOverrides = {};
    for (let i = 1; i <= 60; i += 1) {
      clearedOverrides[i] = {
        driver: 'ND',
        pitScenario: '4_tires_fuel',
        tiresStart: { ...DEFAULT_FULL_TIRES },
        tiresEnd: { ...DEFAULT_FULL_TIRES },
        tiresEndEnabled: false,
      };
    }
    return { clearedPre, clearedOverrides };
  };

  const handleReset = () => {
    setConfirmDialog({
      title: 'Resetar Parâmetros da Corrida',
      message:
        'Deseja mesmo resetar os Parâmetros da Corrida para os valores padrão? Os stints não serão alterados.',
      confirmLabel: 'Resetar Parâmetros',
      tone: 'amber',
      onConfirm: () => {
        setParams(DEFAULT_PARAMS);
        showToast('Parâmetros da corrida resetados!', 'success');
      },
    });
  };

  const handleToggleStintMode = () => {
    if (stintMode === 'planning') {
      if (!racePreSessions || !raceStintOverrides) {
        const { clearedPre, clearedOverrides } = buildClearedSessions();
        if (!racePreSessions) setRacePreSessions(clearedPre);
        if (!raceStintOverrides) setRaceStintOverrides(clearedOverrides);
      }
      setExpandedStintId(null);
      setStintMode('race');
    } else {
      setExpandedStintId(null);
      setStintMode('planning');
    }
  };

  const handleExportPlanningToRace = () => {
    setConfirmDialog({
      title: 'Exportar Planejamento para Corrida',
      message:
        'Deseja exportar o Planejamento para o Modo Corrida? Isso substituirá os dados atuais da corrida.',
      confirmLabel: 'Exportar para Corrida',
      tone: 'emerald',
      onConfirm: () => {
        setRacePreSessions(JSON.parse(JSON.stringify(preSessions)));
        setRaceStintOverrides(JSON.parse(JSON.stringify(stintOverrides)));
        setExpandedStintId(null);
        setStintMode('race');
        showToast('Planejamento exportado para o Modo Corrida!', 'success');
      },
    });
  };

  const handleClearPlanning = () => {
    setConfirmDialog({
      title: 'Limpar Dados de Planejamento',
      message:
        'Deseja mesmo apagar todos os dados do Planejamento? Os pilotos voltarão para ND e os pneus para NOVO.',
      confirmLabel: 'Limpar Planejamento',
      tone: 'red',
      onConfirm: () => {
        const { clearedPre, clearedOverrides } = buildClearedSessions();
        setPreSessions(clearedPre);
        setStintOverrides(clearedOverrides);
        showToast('Dados de planejamento limpos!', 'warning');
      },
    });
  };

  const handleClearRace = () => {
    setConfirmDialog({
      title: 'Limpar Dados da Corrida',
      message:
        'Deseja mesmo apagar todos os dados registrados no Modo Corrida? O Planejamento original será preservado.',
      confirmLabel: 'Limpar Corrida',
      tone: 'red',
      onConfirm: () => {
        const { clearedPre, clearedOverrides } = buildClearedSessions();
        setRacePreSessions(clearedPre);
        setRaceStintOverrides(clearedOverrides);
        setCompletedItems({});
        showToast('Dados da corrida limpos!', 'warning');
      },
    });
  };

  const toggleCompletedItem = (key) => {
    setCompletedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Calculations: Fuel Ratio & Stint Autonomy
  const telemetry = useMemo(
    () => computeCarTelemetry(eventConfig, activeCar.carParams || DEFAULT_CAR_PARAMS),
    [eventConfig, activeCar]
  );

  const activePreSessions =
    stintMode === 'race'
      ? racePreSessions || buildClearedSessions().clearedPre
      : preSessions;
  const activeStintOverrides =
    stintMode === 'race'
      ? raceStintOverrides || buildClearedSessions().clearedOverrides
      : stintOverrides;

  // Build Schedule: Free Practice -> Qualy -> Dynamic Race Stints
  const schedule = useMemo(
    () =>
      computeCarSchedule({
        eventConfig,
        car: activeCar,
        stintMode,
        telemetry,
      }),
    [eventConfig, activeCar, stintMode, telemetry]
  );

  // Overview across all active cars (side-by-side timeline & pitstop coordination)
  const allCarsOverview = useMemo(() => {
    const carSummaries = carOrder
      .map((slotId) => {
        const car = cars[slotId];
        if (!car) return null;
        const carTelemetry = computeCarTelemetry(eventConfig, car.carParams || DEFAULT_CAR_PARAMS);
        const carSchedule = computeCarSchedule({
          eventConfig,
          car,
          stintMode,
          telemetry: carTelemetry,
        });
        const carRaceStints = carSchedule.filter((r) => r.type === 'race');
        const model =
          LMU_CARS.find((c) => c.id === car.carParams?.carId) ||
          LMU_CARS.find((c) => c.classId === car.carParams?.carClass) ||
          LMU_CARS[0];
        const classMeta =
          LMU_CAR_CLASSES.find((cls) => cls.id === model.classId) || LMU_CAR_CLASSES[0];
        const preset = CAR_SLOT_PRESETS[slotId] || CAR_SLOT_PRESETS['car-1'];
        return {
          id: slotId,
          car,
          preset,
          model,
          classMeta,
          telemetry: carTelemetry,
          schedule: carSchedule,
          raceStints: carRaceStints,
          totalLaps: carRaceStints.reduce((acc, r) => acc + r.laps, 0),
          pitCount: carRaceStints.filter((r) => !r.isLastStint).length,
        };
      })
      .filter(Boolean);

    // Chronological pitstop events across all cars
    const pitEvents = [];
    carSummaries.forEach((summary) => {
      summary.raceStints.forEach((stint) => {
        if (!stint.isLastStint) {
          pitEvents.push({
            carId: summary.id,
            carLabel: summary.car.label,
            preset: summary.preset,
            stintLabel: stint.label,
            driver: stint.driver,
            pitTimeMin: stint.endMin,
            stationarySec: stint.pitStationarySec,
            pitlaneLossSec: stint.pitlaneLossSec,
            totalSec: stint.pitDurationSec,
            mfdTargetLabel: stint.mfdTargetLabel,
            scenarioLabel:
              PIT_SCENARIOS.find((p) => p.id === stint.pitScenario)?.label || stint.pitScenario,
          });
        }
      });
    });
    pitEvents.sort((a, b) => a.pitTimeMin - b.pitTimeMin);

    // Flag pitstop overlaps (< 2.5 min between different cars)
    const pitEventsWithWarnings = pitEvents.map((ev, idx) => {
      const prev = idx > 0 ? pitEvents[idx - 1] : null;
      const next = idx < pitEvents.length - 1 ? pitEvents[idx + 1] : null;
      const closeToPrev =
        prev && prev.carId !== ev.carId && Math.abs(ev.pitTimeMin - prev.pitTimeMin) <= 2.5;
      const closeToNext =
        next && next.carId !== ev.carId && Math.abs(next.pitTimeMin - ev.pitTimeMin) <= 2.5;
      return {
        ...ev,
        hasPitOverlap: Boolean(closeToPrev || closeToNext),
      };
    });

    // Detect driver overlap across different cars at the same time
    const driverConflicts = [];
    for (let i = 0; i < carSummaries.length; i += 1) {
      for (let j = i + 1; j < carSummaries.length; j += 1) {
        const a = carSummaries[i];
        const b = carSummaries[j];
        a.raceStints.forEach((sa) => {
          if (!sa.driver || sa.driver === 'ND') return;
          b.raceStints.forEach((sb) => {
            if (sa.driver !== sb.driver) return;
            const overlapStart = Math.max(sa.startMin, sb.startMin);
            const overlapEnd = Math.min(sa.endMin, sb.endMin);
            if (overlapEnd - overlapStart > 0.5) {
              driverConflicts.push({
                driver: sa.driver,
                carA: a.car.label,
                stintA: sa.label,
                carB: b.car.label,
                stintB: sb.label,
                startMin: overlapStart,
                endMin: overlapEnd,
              });
            }
          });
        });
      }
    }

    return {
      carSummaries,
      pitEvents: pitEventsWithWarnings,
      driverConflicts,
    };
  }, [carOrder, cars, eventConfig, stintMode]);

  // Sequential physical tire tracking (#1, #2, #3...) individually across all tires
  const { enrichedSchedule, tireBankByCorner } = useMemo(() => {
    let globalTireNum = 1;
    const bank = { FL: [], FR: [], RL: [], RR: [] };
    const prevMounted = { FL: null, FR: null, RL: null, RR: null };
    const prevPlanIsWet = { FL: false, FR: false, RL: false, RR: false };

    const enriched = schedule.map((row) => {
      if (row.type === 'fp') {
        return { ...row, startTireMeta: null, endTireMeta: null };
      }

      if (stintMode === 'planning') {
        const startTireMeta = {};
        TIRE_CORNERS.forEach(({ key }) => {
          const rawStart = row.tiresStart?.[key];
          const mode =
            rawStart === 'wet'
              ? 'wet'
              : rawStart === 'keep'
              ? 'keep'
              : rawStart === 100 || rawStart === 'new'
              ? 'new'
              : 'used';
          const isWet = mode === 'wet' || (mode === 'keep' && prevPlanIsWet[key]);
          prevPlanIsWet[key] = isWet;
          startTireMeta[key] = {
            mode,
            isWet,
            canKeep: true,
            tireNum: null,
            tireId: '',
            pct: null,
            sourceLabel: null,
          };
        });
        return { ...row, startTireMeta, endTireMeta: null };
      }

      const startTireMeta = {};
      const endTireMeta = {};

      TIRE_CORNERS.forEach(({ key }) => {
        const rawStart = row.tiresStart?.[key];
        const canKeep = Boolean(prevMounted[key]);
        const isWet = rawStart === 'wet';
        const isKeep = rawStart === 'keep' && canKeep;
        const isNew = rawStart === 100 || rawStart === 'new';

        if (isWet) {
          prevMounted[key] = {
            isWet: true,
            num: null,
            id: '',
            currentPct: row.tiresEndEnabled
              ? Math.min(100, Math.max(0, Number(row.tiresEnd?.[key]) || 0))
              : null,
            lastSource: row.label,
            hasRecordedWear: Boolean(row.tiresEndEnabled),
          };
          startTireMeta[key] = {
            mode: 'wet',
            isWet: true,
            canKeep,
            tireNum: null,
            tireId: '',
            pct: null,
            sourceLabel: null,
          };
          endTireMeta[key] = { tireNum: null, tireId: '💧' };
        } else if (isNew) {
          const num = globalTireNum++;
          const tire = {
            isWet: false,
            num,
            id: `#${num}`,
            currentPct: row.tiresEndEnabled
              ? Math.min(100, Math.max(0, Number(row.tiresEnd?.[key]) || 0))
              : null,
            lastSource: row.label,
            hasRecordedWear: Boolean(row.tiresEndEnabled),
          };
          bank[key].push(tire);
          prevMounted[key] = tire;
          startTireMeta[key] = {
            mode: 'new',
            isWet: false,
            canKeep,
            tireNum: num,
            tireId: `#${num}`,
            pct: 100,
            sourceLabel: null,
          };
          endTireMeta[key] = { tireNum: num, tireId: `#${num}` };
        } else if (isKeep) {
          const chosen = prevMounted[key];
          const startPct = chosen.hasRecordedWear ? chosen.currentPct : 'ND';
          const sourceLabel = chosen.lastSource;
          if (row.tiresEndEnabled) {
            chosen.currentPct = Math.min(100, Math.max(0, Number(row.tiresEnd?.[key]) || 0));
            chosen.lastSource = row.label;
            chosen.hasRecordedWear = true;
          }
          prevMounted[key] = chosen;
          startTireMeta[key] = {
            mode: 'keep',
            isWet: Boolean(chosen.isWet),
            canKeep,
            tireNum: chosen.num,
            tireId: chosen.id,
            pct: startPct,
            sourceLabel,
          };
          endTireMeta[key] = { tireNum: chosen.num, tireId: chosen.isWet ? '💧' : chosen.id };
        } else {
          const recorded = bank[key].filter((t) => t.hasRecordedWear);
          let chosen = null;
          if (recorded.length > 0) {
            chosen = recorded.reduce(
              (best, t) => (t.currentPct > best.currentPct ? t : best),
              recorded[0]
            );
          } else if (bank[key].length > 0) {
            chosen = bank[key][bank[key].length - 1];
          }

          if (chosen) {
            const startPct = chosen.hasRecordedWear ? chosen.currentPct : 'ND';
            const sourceLabel = chosen.lastSource;
            if (row.tiresEndEnabled) {
              chosen.currentPct = Math.min(100, Math.max(0, Number(row.tiresEnd?.[key]) || 0));
              chosen.lastSource = row.label;
              chosen.hasRecordedWear = true;
            }
            prevMounted[key] = chosen;
            startTireMeta[key] = {
              mode: 'used',
              canKeep,
              tireNum: chosen.num,
              tireId: chosen.id,
              pct: startPct,
              sourceLabel,
            };
            endTireMeta[key] = { tireNum: chosen.num, tireId: chosen.id };
          } else {
            startTireMeta[key] = {
              mode: 'used',
              canKeep,
              tireNum: null,
              tireId: '—',
              pct: 'ND',
              sourceLabel: null,
            };
            endTireMeta[key] = { tireNum: null, tireId: '—' };
          }
        }
      });

      return {
        ...row,
        startTireMeta,
        endTireMeta,
      };
    });

    return { enrichedSchedule: enriched, tireBankByCorner: bank };
  }, [schedule, stintMode]);

  // Tire Reuse Analyzer: ranks physical tires (#1, #2...) by their latest remaining %
  const tireRecommendations = useMemo(() => {
    const result = {};

    TIRE_CORNERS.forEach(({ key, label }) => {
      const candidates = tireBankByCorner[key]
        .filter((t) => t.hasRecordedWear)
        .map((t) => ({
          id: `${key}-${t.id}`,
          tireId: t.id,
          sourceLabel: t.lastSource,
          pct: t.currentPct,
        }))
        .sort((a, b) => b.pct - a.pct);

      const best = candidates[0] || null;
      const secondBest = candidates[1] || null;

      result[key] = {
        key,
        label,
        best,
        secondBest,
        all: candidates,
      };
    });

    return result;
  }, [tireBankByCorner]);

  const canAssignDriver = (targetRowId, nextDriver) => {
    if (nextDriver === 'ND') return true;
    const nextSet = new Set(
      schedule
        .filter((s) => s.type !== 'fp')
        .map((s) => (s.id === targetRowId ? nextDriver : s.driver))
        .filter((d) => Boolean(d) && d !== 'ND')
    );
    return nextSet.size <= 6;
  };

  const notifyMaxDriversLimit = () => {
    setToast({
      message: 'Limite do simulador: máximo de 6 pilotos diferentes por sessão.',
      type: 'warning',
    });
  };

  const updatePreSession = (sessionKey, field, value) => {
    if (field === 'driver' && !canAssignDriver(sessionKey, value)) {
      notifyMaxDriversLimit();
      return;
    }
    const setter = stintMode === 'race' ? setRacePreSessions : setPreSessions;
    setter((prev) => {
      const base = prev || preSessions;
      return {
        ...base,
        [sessionKey]: {
          ...base[sessionKey],
          [field]: value,
        },
      };
    });
  };

  const updatePreSessionTire = (sessionKey, phase, corner, pct) => {
    const setter = stintMode === 'race' ? setRacePreSessions : setPreSessions;
    setter((prev) => {
      const base = prev || preSessions;
      const current = base[sessionKey];
      const existingPhase = current[phase] || current.tires || DEFAULT_FULL_TIRES;
      return {
        ...base,
        [sessionKey]: {
          ...current,
          [phase]: {
            ...existingPhase,
            [corner]: pct,
          },
        },
      };
    });
  };

  const updateRaceStint = (stintNum, field, value) => {
    if (field === 'driver' && !canAssignDriver(`stint_${stintNum}`, value)) {
      notifyMaxDriversLimit();
      return;
    }
    const setter = stintMode === 'race' ? setRaceStintOverrides : setStintOverrides;
    setter((prev) => {
      const base = prev || stintOverrides;
      const current = base[stintNum] || {
        driver: DRIVERS[(stintNum - 1) % Math.min(6, DRIVERS.length)],
        pitScenario: '4_tires_fuel',
        tiresStart: DEFAULT_FULL_TIRES,
        tiresEnd: { FL: 72, FR: 68, RL: 76, RR: 74 },
      };
      const nextState = {
        ...base,
        [stintNum]: {
          ...current,
          [field]: value,
        },
      };

      if (
        field === 'pitScenario' &&
        (value === 'driver_swap_only' || value === 'fuel_only')
      ) {
        const nextStintNum = stintNum + 1;
        const nextStintCurrent = base[nextStintNum] || {
          driver: DRIVERS[(nextStintNum - 1) % Math.min(6, DRIVERS.length)],
          pitScenario: '4_tires_fuel',
          tiresStart: DEFAULT_FULL_TIRES,
          tiresEnd: { FL: 72, FR: 68, RL: 76, RR: 74 },
          tiresEndEnabled: false,
        };
        nextState[nextStintNum] = {
          ...nextStintCurrent,
          tiresStart: { FL: 'keep', FR: 'keep', RL: 'keep', RR: 'keep' },
        };
      }

      return nextState;
    });
  };

  const updateRaceStintTire = (stintNum, phase, corner, pct) => {
    const setter = stintMode === 'race' ? setRaceStintOverrides : setStintOverrides;
    setter((prev) => {
      const base = prev || stintOverrides;
      const current = base[stintNum] || {
        driver: DRIVERS[(stintNum - 1) % Math.min(6, DRIVERS.length)],
        pitScenario: '4_tires_fuel',
        tiresStart: DEFAULT_FULL_TIRES,
        tiresEnd: { FL: 72, FR: 68, RL: 76, RR: 74 },
      };
      const existingPhase =
        current[phase] ||
        (phase === 'tiresStart' ? DEFAULT_FULL_TIRES : current.tires || { FL: 72, FR: 68, RL: 76, RR: 74 });
      return {
        ...base,
        [stintNum]: {
          ...current,
          [phase]: {
            ...existingPhase,
            [corner]: pct,
          },
        },
      };
    });
  };

  const getBestUsedTireForCorner = (rowIndex, corner) => {
    const previousRows = schedule
      .slice(0, rowIndex)
      .filter((r) => r.type !== 'fp' && r.tiresEndEnabled);
    if (previousRows.length === 0) return null;

    let best = null;
    previousRows.forEach((prevRow) => {
      const pct = Math.min(100, Math.max(0, Number(prevRow.tiresEnd?.[corner]) || 0));
      if (!best || pct > best.pct) {
        best = { pct, sourceLabel: prevRow.label };
      }
    });
    return best;
  };

  const selectedCar = useMemo(() => {
    return (
      LMU_CARS.find((c) => c.id === params.carId) ||
      LMU_CARS.find((c) => c.classId === params.carClass) ||
      LMU_CARS[0]
    );
  }, [params.carId, params.carClass]);

  const selectedClassMeta = useMemo(() => {
    return (
      LMU_CAR_CLASSES.find((cls) => cls.id === selectedCar.classId) ||
      LMU_CAR_CLASSES[0]
    );
  }, [selectedCar]);

  const carsInSelectedClass = useMemo(() => {
    return LMU_CARS.filter((c) => c.classId === (params.carClass || selectedCar.classId));
  }, [params.carClass, selectedCar]);

  const selectedCircuit = useMemo(() => {
    return LMU_CIRCUITS.find((c) => c.id === params.circuitId) || LMU_CIRCUITS[3];
  }, [params.circuitId]);

  const goToMobilePage = (pageIdx) => {
    setMobilePage(pageIdx);
    if (mobilePagerRef.current) {
      mobilePagerRef.current.scrollTo({
        left: pageIdx * mobilePagerRef.current.clientWidth,
        behavior: 'smooth',
      });
    }
  };

  const toggleMobilePage = (targetPage) => {
    if (mobilePage === targetPage) {
      const fallback = prevMobilePageRef.current !== targetPage ? prevMobilePageRef.current : 1;
      goToMobilePage(fallback);
    } else {
      prevMobilePageRef.current = mobilePage;
      goToMobilePage(targetPage);
    }
  };

  const goToMobileParamField = (fieldRef) => {
    prevMobilePageRef.current = mobilePage;
    goToMobilePage(0);
    setTimeout(() => {
      const el = fieldRef?.current;
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus();
      if (typeof el.showPicker === 'function') {
        try {
          el.showPicker();
        } catch {
          // Ignore if browser blocks programmatic showPicker
        }
      }
      if (typeof el.select === 'function' && el.type === 'number') {
        el.select();
      }
    }, 320);
  };

  const handleMobilePagerScroll = () => {
    const el = mobilePagerRef.current;
    if (!el || !el.clientWidth) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== mobilePage && idx >= 0 && idx <= 2) {
      setMobilePage(idx);
    }
  };

  useEffect(() => {
    const el = mobilePagerRef.current;
    if (!mobilePagerInitRef.current && el && el.clientWidth > 0) {
      mobilePagerInitRef.current = true;
      el.scrollLeft = el.clientWidth; // Open on center section (Stints)
    }
  }, []);

  const toggleStintCollapse = (rowId) => {
    setExpandedStintId((prev) => (prev === rowId ? null : rowId));
  };

  const handleGoToCalendar = () => {
    if (window.innerWidth < 1024) {
      prevMobilePageRef.current = mobilePage;
      goToMobilePage(2);
      setTimeout(() => {
        mobileCalendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 340);
    } else {
      desktopCalendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const openCalendarEventModal = (ev) => {
    if (!ev || ev.status === 'past') {
      showToast('Etapa já encerrada — não é possível registrar interesse.', 'warning');
      return;
    }
    setCalendarEventModal(ev);
    const availableDrivers = DRIVERS.filter((d) => d !== 'ND');
    const existingList = eventSignups[ev.id] || [];
    const defaultDriver = availableDrivers[0];
    const existingForDefault = existingList.find((item) => item.driver === defaultDriver);
    setSignupDriverDraft(defaultDriver);
    setSignupClassesDraft(
      existingForDefault?.classes?.length ? existingForDefault.classes : ['LMGT3']
    );
  };

  const toggleSignupClass = (classId) => {
    setSignupClassesDraft((prev) =>
      prev.includes(classId) ? prev.filter((c) => c !== classId) : [...prev, classId]
    );
  };

  const handleSaveEventSignup = (e) => {
    e.preventDefault();
    if (!calendarEventModal || !signupDriverDraft) return;
    if (signupClassesDraft.length === 0) {
      showToast('Selecione pelo menos uma categoria viável.', 'warning');
      return;
    }
    setEventSignups((prev) => {
      const list = prev[calendarEventModal.id] || [];
      const filtered = list.filter((item) => item.driver !== signupDriverDraft);
      return {
        ...prev,
        [calendarEventModal.id]: [
          ...filtered,
          { driver: signupDriverDraft, classes: signupClassesDraft },
        ],
      };
    });
    showToast(`${signupDriverDraft} pré-cadastrado em ${calendarEventModal.track}!`, 'success');
  };

  const handleRemoveEventSignup = (eventId, driverName) => {
    setEventSignups((prev) => ({
      ...prev,
      [eventId]: (prev[eventId] || []).filter((item) => item.driver !== driverName),
    }));
  };

  const handleConnectLiveRoom = (e) => {
    e.preventDefault();
    const cleaned = pinDraft.trim().toUpperCase();
    if (!cleaned) return;
    setRoomPin(cleaned);
    setPinDraft(cleaned);
    try {
      localStorage.setItem(ROOM_PIN_STORAGE_KEY, cleaned);
    } catch {
      // ignore
    }
    if (!isSupabaseConfigured) {
      setLiveRoomEnabled(false);
      setSyncStatus('local');
      setRoomModalOpen(false);
      showToast('Supabase não configurado (.env). Operando em Modo Local.', 'warning');
      return;
    }
    setLiveRoomEnabled(true);
    setRoomModalOpen(false);
    showToast(`Conectando à sala ${cleaned}...`, 'success');
  };

  const handleCopyWhatsApp = async () => {
    const totalRaceMin = parseDurationHHMMToMinutes(params.raceDurationStr);
    const lines = [
      `🏁 *FTR PITWALL — Endurance Strategist (LMU)*`,
      `🛣️ *Circuito:* ${selectedCircuit.name} (${selectedCircuit.country})`,
      `🏎️ *Carro (${activeCar.label}):* [${selectedClassMeta.label}] ${selectedCar.name}`,
      `⏱️ *Início:* ${params.sessionStart} | *Corrida:* ${params.raceDurationStr} (${totalRaceMin} min)`,
      telemetry.isElms
        ? `⛽ *Regulamento:* ELMS | *Autonomia Máx:* ${telemetry.maxStintLaps} voltas (~${telemetry.maxStintMin.toFixed(1)} min)`
        : `⛽ *Fuel Ratio:* ${telemetry.fuelRatio.toFixed(2)} L/% | *Autonomia Máx:* ${telemetry.maxStintLaps} voltas (~${telemetry.maxStintMin.toFixed(1)} min)`,
      `⏱️ *Volta Base:* ${params.lapTimeStr}`,
      ``,
      `📋 *CRONOGRAMA DE STINTS:*`,
    ];

    enrichedSchedule.forEach((row) => {
      const timeRange = `${formatMinutesToHHMM(row.startMin)} - ${formatMinutesToHHMM(row.endMin)}`;
      const pitInfo =
        row.type === 'race' && !row.isLastStint
          ? ` | Pit MFD: ${row.mfdTargetLabel} • ${PIT_SCENARIOS.find((p) => p.id === row.pitScenario)?.label} (Box ${row.pitStationarySec}s + Pit ${row.pitlaneLossSec}s)`
          : row.isLastStint
            ? ' | 🏁 Bandeira Quadriculada'
            : '';
      if (row.type === 'fp') {
        lines.push(
          `• *${row.label}* (${timeRange}) — ${row.driver} | ${Math.round(row.durationMin)}m (${row.laps}v)\n  🛞 Sem desgaste de pneus`
        );
      } else {
        const fmtStart = (k) => {
          const m = row.startTireMeta?.[k];
          if (!m) return 'NOVO';
          if (m.mode === 'new') return `${m.tireId}:NOVO`;
          if (m.mode === 'keep') return `${m.tireId}:MANTER(${m.pct === 'ND' ? 'ND' : `${m.pct}%`})`;
          return `${m.tireId}:${m.pct === 'ND' ? 'ND' : `${m.pct}%`}`;
        };
        const tiresStartInfo = `FL(${fmtStart('FL')}) FR(${fmtStart('FR')}) RL(${fmtStart('RL')}) RR(${fmtStart('RR')})`;
        const tiresEndInfo = row.tiresEndEnabled
          ? `FL(${row.endTireMeta?.FL?.tireId || ''}:${row.tiresEnd.FL}%) FR(${row.endTireMeta?.FR?.tireId || ''}:${row.tiresEnd.FR}%) RL(${row.endTireMeta?.RL?.tireId || ''}:${row.tiresEnd.RL}%) RR(${row.endTireMeta?.RR?.tireId || ''}:${row.tiresEnd.RR}%)`
          : 'Aguardando registro';
        lines.push(
          `• *${row.label}* (${timeRange}) — ${row.driver} | ${Math.round(row.durationMin)}m (${row.laps}v)${pitInfo}\n  🟢 Início: ${tiresStartInfo}\n  🛞 Fim: ${tiresEndInfo}`
        );
      }
    });

    lines.push(``);
    lines.push(`♻️ *MELHORES PNEUS P/ REAPROVEITAR:*`);
    TIRE_CORNERS.forEach(({ key }) => {
      const rec = tireRecommendations[key];
      if (rec?.best) {
        lines.push(`• *${key} ${rec.best.tireId}:* ${rec.best.pct}% (${rec.best.sourceLabel}) — SUGERIDO`);
      }
    });

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback if clipboard is unavailable
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const raceStints = useMemo(() => schedule.filter((r) => r.type === 'race'), [schedule]);
  const raceStintCount = raceStints.length;
  const totalEstimatedLaps = raceStints.reduce((acc, r) => acc + r.laps, 0);

  const raceDriverStats = useMemo(() => {
    const map = new Map();
    schedule
      .filter((r) => r.type === 'race' && r.driver && r.driver !== 'ND')
      .forEach((r) => {
        const prev = map.get(r.driver) || { driver: r.driver, laps: 0, durationMin: 0 };
        prev.laps += r.laps || 0;
        prev.durationMin += r.durationMin || 0;
        map.set(r.driver, prev);
      });
    return Array.from(map.values())
      .sort((a, b) => b.durationMin - a.durationMin || b.laps - a.laps)
      .slice(0, 6);
  }, [schedule]);

  const usedTiresCount = useMemo(() => {
    return (
      tireBankByCorner.FL.length +
      tireBankByCorner.FR.length +
      tireBankByCorner.RL.length +
      tireBankByCorner.RR.length
    );
  }, [tireBankByCorner]);

  const availableTiresNum = Math.max(0, Number(params.availableTires) || 0);
  const remainingTiresCount = availableTiresNum - usedTiresCount;

  const calendarEvents = useMemo(() => buildLmuWeekendCalendar(), []);
  const upcomingEvents = useMemo(
    () => calendarEvents.filter((e) => e.status !== 'past'),
    [calendarEvents]
  );
  const nextEvent = useMemo(
    () => calendarEvents.find((e) => e.status === 'next') || calendarEvents[calendarEvents.length - 1],
    [calendarEvents]
  );

  useEffect(() => {
    if (upcomingEvents.length <= 1) return;
    const timer = setInterval(() => {
      setHeaderEventIdx((prev) => (prev + 1) % upcomingEvents.length);
    }, 10000);
    return () => clearInterval(timer);
  }, [upcomingEvents.length]);

  const activeHeaderEvent =
    upcomingEvents.length > 0
      ? upcomingEvents[headerEventIdx % upcomingEvents.length]
      : nextEvent;
  const isImmediateNextHeaderEvent =
    activeHeaderEvent && nextEvent && activeHeaderEvent.id === nextEvent.id;

  useEffect(() => {
    if (isPinLocked) return;
    const containers = document.querySelectorAll('.calendar-events-scroll');
    containers.forEach((container) => {
      const target = container.querySelector('[data-next-event="true"]');
      if (target) {
        container.scrollTop = Math.max(0, target.offsetTop - container.offsetTop - 4);
      }
    });
  }, [isPinLocked, mobilePage, nextEvent?.id]);

  const calendarCard = (
    <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#eab308]" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Calendário LMU Q3/Q4 2026
          </h2>
        </div>
        <span className="text-[10px] font-medium text-slate-400">Sáb & Dom</span>
      </div>

      {nextEvent && (() => {
        const nextSignups = eventSignups[nextEvent.id] || [];
        const nextFlag =
          nextEvent.id === 'tba-dec'
            ? '🏁'
            : LMU_CIRCUITS.find((c) => c.id === detectCircuitIdFromEvent(nextEvent))?.flag || '🏁';
        return (
          <button
            type="button"
            onClick={() => openCalendarEventModal(nextEvent)}
            title="Clique para pré-cadastrar piloto nesta etapa"
            className="mb-3 w-full text-left rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 cursor-pointer transition-colors hover:bg-amber-500/20 active:scale-[0.99]"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#eab308]">
                <Sparkles className="h-3 w-3" />
                <span>Próximo Evento</span>
              </div>
              {nextSignups.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 border border-emerald-500/40 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#22c55e]">
                  <Users className="h-2.5 w-2.5" />
                  ({String(nextSignups.length).padStart(2, '0')})
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-sm font-bold text-white">
              <span className="text-base leading-none">{nextFlag}</span>
              <span>
                {nextEvent.track}
                {nextSignups.length > 0 ? ` (${String(nextSignups.length).padStart(2, '0')})` : ''} — {nextEvent.dates}
              </span>
            </div>
            <div className="text-[11px] text-amber-200/80">
              {nextEvent.classes}
            </div>
          </button>
        );
      })()}

      <div className="calendar-events-scroll max-h-52 space-y-1.5 overflow-y-auto pr-1">
        {calendarEvents.map((ev) => {
          const signups = eventSignups[ev.id] || [];
          const evFlag =
            ev.id === 'tba-dec'
              ? '🏁'
              : LMU_CIRCUITS.find((c) => c.id === detectCircuitIdFromEvent(ev))?.flag || '🏁';
          return (
            <button
              type="button"
              key={ev.id}
              data-next-event={ev.status === 'next' ? 'true' : undefined}
              disabled={ev.status === 'past'}
              onClick={() => openCalendarEventModal(ev)}
              title={
                ev.status === 'past'
                  ? 'Etapa já encerrada'
                  : 'Clique para pré-cadastrar piloto nesta etapa'
              }
              className={`w-full text-left flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                ev.status === 'next'
                  ? 'bg-amber-500/15 border border-amber-500/30 text-amber-200 font-semibold hover:bg-amber-500/25 cursor-pointer'
                  : ev.status === 'past'
                  ? 'text-slate-500 line-through opacity-60 cursor-not-allowed'
                  : 'text-slate-300 bg-[#0f172a]/50 hover:bg-[#0f172a] cursor-pointer'
              }`}
            >
              <span className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                <span className="shrink-0 text-sm leading-none">{evFlag}</span>
                <span className="truncate">
                  {ev.track}
                  {signups.length > 0 && (
                    <span className="ml-1 font-mono text-[11px] font-bold text-[#22c55e]">
                      ({String(signups.length).padStart(2, '0')})
                    </span>
                  )}
                </span>
              </span>
              <span className="shrink-0 font-mono text-[11px]">{ev.dates}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col">
      {/* TOP BAR */}
      <header className="sticky top-0 z-40 border-b border-[#334155] bg-[#0f172a]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] flex-wrap xl:flex-nowrap items-center justify-between gap-2 xl:gap-2.5 px-4 py-2.5 sm:px-5">
          <div className="flex w-full lg:w-auto items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <img
                src="/ftr-logo.jpg"
                alt="Faster Team Racing"
                className="h-11 w-11 shrink-0 rounded-lg object-cover border border-amber-500/40 bg-black"
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-extrabold tracking-tight text-white sm:text-xl">
                    FTR <span className="text-[#eab308]">PITWALL</span>
                  </h1>
                  <span className="hidden rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#22c55e] sm:inline-block">
                    LMU Protótipo
                  </span>
                </div>
                <p className="text-xs text-slate-400">Engenharia de Corrida</p>
              </div>
            </div>

            {/* Car Brand Logo + Flag (left col) | Class + Short Track (right col) on Mobile & < xl */}
            <button
              type="button"
              disabled={isPinLocked}
              onClick={() => goToMobileParamField(mobileCarTrackRef)}
              title="Escolher carro ou pista nos Parâmetros"
              className={`xl:hidden flex items-center justify-center gap-2 rounded-md border border-[#334155] bg-[#1e293b]/90 px-2.5 py-1 transition-colors ${
                isPinLocked
                  ? 'opacity-50 pointer-events-none'
                  : 'cursor-pointer hover:border-amber-500/50 active:scale-[0.98]'
              }`}
            >
              <div className="flex flex-col items-center justify-center leading-none">
                <ManufacturerLogo brand={selectedCar.brand} size={18} />
                <span className="mt-1 text-[11px] leading-none">
                  {isPinLocked ? '🏁' : selectedCircuit.flag}
                </span>
              </div>
              <div className="flex flex-col items-center justify-center text-center leading-none">
                <span
                  className={`rounded border px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider leading-none ${selectedClassMeta.badgeClass}`}
                >
                  {isPinLocked ? '---' : selectedClassMeta.label}
                </span>
                <span className="mt-1 text-[8.5px] font-semibold text-slate-300 leading-none">
                  {isPinLocked ? '---' : selectedCircuit.shortName}
                </span>
              </div>
            </button>
          </div>

          {activeHeaderEvent && (
            <div className="w-full sm:w-auto flex justify-center">
              <button
                type="button"
                onClick={handleGoToCalendar}
                title="Ir para o Calendário LMU"
                className="relative inline-flex overflow-hidden rounded-lg p-[1.5px] shadow-[0_0_15px_rgba(234,179,8,0.18)] cursor-pointer transition-transform active:scale-[0.98]"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-[-150%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0deg_250deg,#eab308_310deg,#fef08a_335deg,transparent_360deg)]"
                />
                <div className="relative flex items-center justify-center gap-2 rounded-[7px] bg-[#0f172a] bg-gradient-to-r from-[#1e293b]/90 via-[#0f172a] to-[#1e293b]/90 px-3 py-1.5 text-xs text-center">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#eab308]" />
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#eab308] mr-1.5">
                      {isImmediateNextHeaderEvent ? 'Próxima Corrida:' : 'Em Breve:'}
                    </span>
                    <span className="font-bold text-white">{activeHeaderEvent.track}</span>
                    <span className="ml-1.5 font-mono text-[11px] text-amber-200">
                      ({activeHeaderEvent.dates})
                    </span>
                  </div>
                </div>
              </button>
            </div>
          )}

          <div className="hidden xl:flex items-center justify-center gap-2.5 rounded-lg border border-[#334155] bg-[#1e293b]/90 px-2.5 py-1.5 shrink-0">
            <div className="flex flex-col items-center justify-center leading-none">
              <ManufacturerLogo brand={selectedCar.brand} size={24} />
              <span className="mt-1 text-sm leading-none" title={selectedCircuit.country}>
                {selectedCircuit.flag}
              </span>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-[11px] font-bold text-white whitespace-nowrap">{selectedCar.name}</span>
                <span
                  className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${selectedClassMeta.badgeClass}`}
                >
                  {selectedClassMeta.label}
                </span>
              </div>
              <div className="mt-0.5 flex items-center justify-center gap-1 text-[10px] text-slate-400">
                <MapPin className="h-2.5 w-2.5 shrink-0 text-[#eab308]" />
                <span className="truncate max-w-[180px]">{selectedCircuit.name}</span>
              </div>
            </div>
          </div>

          <div className="flex w-full sm:w-auto flex-wrap sm:flex-nowrap items-center justify-between sm:justify-start gap-1.5 shrink-0">
            {/* Desktop Connection Status Pill */}
            <div
              className={`hidden sm:inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-semibold ${syncStatus === 'live'
                ? 'border-emerald-500/40 bg-emerald-500/15 text-[#22c55e]'
                : 'border-amber-500/40 bg-amber-500/10 text-[#eab308]'
                }`}
              title={
                syncStatus === 'live'
                  ? `Conectado à sala ${roomPin} (${livePeersCount} conectado${livePeersCount === 1 ? '' : 's'})`
                  : 'Salvamento local automático (offline fallback)'
              }
            >
              <span
                className={`h-2 w-2 rounded-full ${syncStatus === 'live' ? 'bg-[#22c55e] animate-pulse' : 'bg-[#eab308]'
                  }`}
              />
              <span>
                {syncStatus === 'live'
                  ? `Sincronizado ao Vivo (${String(livePeersCount).padStart(2, '0')})`
                  : 'Modo Local'}
              </span>
            </div>

            {/* Live Room (PIN) Trigger — Desktop separate, Mobile unified with Status */}
            <div className="relative">
              {/* Desktop animated trigger */}
              <div
                className={`hidden sm:inline-flex relative overflow-hidden rounded-lg p-[1.5px] transition-shadow ${
                  syncStatus === 'live'
                    ? 'shadow-[0_0_14px_rgba(34,197,94,0.3)]'
                    : 'shadow-[0_0_18px_rgba(234,179,8,0.4)]'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-[-150%] animate-[spin_2.6s_linear_infinite] ${
                    syncStatus === 'live'
                      ? 'bg-[conic-gradient(from_0deg,transparent_0deg_240deg,#22c55e_305deg,#86efac_335deg,transparent_360deg)]'
                      : 'bg-[conic-gradient(from_0deg,transparent_0deg_230deg,#eab308_300deg,#fef08a_335deg,transparent_360deg)]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => {
                    setPinDraft(roomPin);
                    setRoomModalOpen((prev) => !prev);
                  }}
                  className={`relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-[7px] px-2 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                    syncStatus === 'live'
                      ? 'bg-[#0b1f17] text-emerald-300 hover:bg-[#0f291e]'
                      : 'bg-[#1a1608] text-amber-200 hover:bg-[#241e0a]'
                  }`}
                  title="Configurar Sala Ao Vivo (PIN)"
                >
                  <Radio
                    className={`h-3.5 w-3.5 ${
                      syncStatus === 'live'
                        ? 'text-[#22c55e] animate-pulse'
                        : 'text-[#eab308] animate-bounce'
                    }`}
                  />
                  <span className="hidden 2xl:inline">
                    {syncStatus === 'live' ? 'Sala:' : 'Conectar:'}
                  </span>
                  <span className="font-mono text-[11px] font-extrabold text-white">
                    {roomPin || 'PIN'}
                  </span>
                </button>
              </div>

              {/* Mobile animated unified trigger */}
              <div
                className={`inline-flex sm:hidden relative overflow-hidden rounded-lg p-[1.5px] transition-shadow ${
                  syncStatus === 'live'
                    ? 'shadow-[0_0_14px_rgba(34,197,94,0.3)]'
                    : 'shadow-[0_0_18px_rgba(234,179,8,0.42)]'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-[-150%] animate-[spin_2.6s_linear_infinite] ${
                    syncStatus === 'live'
                      ? 'bg-[conic-gradient(from_0deg,transparent_0deg_240deg,#22c55e_305deg,#86efac_335deg,transparent_360deg)]'
                      : 'bg-[conic-gradient(from_0deg,transparent_0deg_230deg,#eab308_300deg,#fef08a_335deg,transparent_360deg)]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => {
                    setPinDraft(roomPin);
                    setRoomModalOpen((prev) => !prev);
                  }}
                  className={`relative inline-flex items-center justify-center gap-1.5 rounded-[7px] px-2.5 py-1 text-center transition-colors cursor-pointer ${
                    syncStatus === 'live'
                      ? 'bg-[#0b1f17] text-[#22c55e]'
                      : 'bg-[#1a1608] text-amber-200'
                  }`}
                  title="Status e Sala Ao Vivo (PIN)"
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      syncStatus === 'live'
                        ? 'bg-[#22c55e] animate-pulse'
                        : 'bg-[#eab308] animate-ping'
                    }`}
                  />
                  <span className="flex flex-col items-center leading-tight">
                    <span className="whitespace-nowrap text-[9px] font-bold uppercase tracking-wider opacity-95">
                      {syncStatus === 'live'
                        ? `Ao Vivo (${String(livePeersCount).padStart(2, '0')})`
                        : 'Modo Local'}
                    </span>
                    <span className="font-mono text-[10px] font-extrabold text-white">
                      {roomPin || 'Conectar'}
                    </span>
                  </span>
                </button>
              </div>

              {roomModalOpen && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:block sm:bg-transparent sm:p-0"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setRoomModalOpen(false);
                  }}
                >
                  <div className="w-full max-w-xs sm:w-72 rounded-xl border border-[#334155] bg-[#0f172a] p-4 shadow-2xl">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Sala Ao Vivo (PIN)
                    </span>
                    <button
                      type="button"
                      onClick={() => setRoomModalOpen(false)}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <form onSubmit={handleConnectLiveRoom} className="space-y-2.5">
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">
                        PIN da Equipe
                      </label>
                      <input
                        type="text"
                        value={pinDraft}
                        onChange={(e) => setPinDraft(e.target.value.toUpperCase())}
                        placeholder="Digite o PIN..."
                        className="w-full rounded-lg border border-[#334155] bg-[#1e293b] px-2.5 py-1.5 text-xs font-mono font-bold uppercase text-white focus:border-[#eab308] focus:outline-none"
                      />
                    </div>

                    {!isSupabaseConfigured && (
                      <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[10px] leading-relaxed text-amber-200">
                        Variáveis <code className="font-mono">VITE_SUPABASE_URL</code> e{' '}
                        <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> não detectadas.
                        Operando em <strong>Modo Local</strong> com fallback automático.
                      </p>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        className="flex-1 rounded-lg bg-[#eab308] px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer"
                      >
                        {liveRoomEnabled ? 'Atualizar Sala' : 'Conectar Sala'}
                      </button>
                      {liveRoomEnabled && (
                        <button
                          type="button"
                          onClick={() => {
                            setLiveRoomEnabled(false);
                            setRoomPin('');
                            setPinDraft('');
                            try {
                              localStorage.removeItem(ROOM_PIN_STORAGE_KEY);
                            } catch {
                              // ignore
                            }
                            setSyncStatus('local');
                            setRoomModalOpen(false);
                            showToast('Desconectado da sala. Informe o PIN para acessar.', 'warning');
                          }}
                          className="rounded-lg border border-[#334155] bg-[#1e293b] px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
                        >
                          Sair
                        </button>
                      )}
                    </div>
                  </form>
                  </div>
                </div>
              )}
            </div>

            <div className={`inline-flex ${isPinLocked ? 'opacity-40 pointer-events-none' : ''}`}>
              <StintModeToggleSwitch mode={stintMode} onToggle={handleToggleStintMode} />
            </div>

            <button
              type="button"
              disabled={isPinLocked}
              onClick={handleCopyWhatsApp}
              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg border px-2 py-1.5 sm:px-2.5 text-xs font-bold transition-all ${
                isPinLocked
                  ? 'border-amber-500/30 bg-[#eab308]/40 text-slate-950 opacity-40 pointer-events-none'
                  : copied
                  ? 'border-emerald-500/60 bg-emerald-500/20 text-[#22c55e] cursor-pointer'
                  : 'border-amber-500/50 bg-[#eab308] text-slate-950 hover:bg-amber-400 cursor-pointer'
                }`}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Copiado!</span>
                  <span className="sm:hidden">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>WhatsApp</span>
                </>
              )}
            </button>

            {/* Mobile-only best tire reuse summary on its own row below */}
            <div
              onClick={() => !isPinLocked && toggleMobilePage(2)}
              title={mobilePage === 2 ? 'Voltar para a tela anterior' : 'Ver conjunto detalhado de pneus usados'}
              className={`w-full sm:hidden flex items-center justify-between gap-2 rounded-lg border border-emerald-500/35 bg-[#1e293b] px-2.5 py-1.5 text-[10px] font-mono transition-all ${
                isPinLocked
                  ? 'opacity-50 pointer-events-none'
                  : stintMode === 'planning'
                  ? 'opacity-25 cursor-pointer hover:border-emerald-400/60 active:scale-[0.99]'
                  : 'cursor-pointer hover:border-emerald-400/60 active:scale-[0.99]'
              }`}
            >
              <div className="flex items-center gap-1.5 shrink-0 text-[#22c55e] font-sans font-bold uppercase tracking-wider text-[9px]">
                <Disc className="h-3.5 w-3.5" />
                <span>Melhores Pneus Usados</span>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-x-2.5 gap-y-0.5">
                {TIRE_CORNERS.map(({ key }) => {
                  const best = tireRecommendations[key]?.best;
                  return (
                    <span key={`mob-rec-${key}`} className="tabular-nums">
                      <span className="text-slate-400">{key}:</span>{' '}
                      {!isPinLocked && best ? (
                        <span className={`font-bold ${getTireTextColor(best.pct)}`}>
                          {best.tireId} {best.pct}%
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Mobile-only 1-line race summary strip */}
            <div
              onClick={() => !isPinLocked && toggleMobilePage(0)}
              title={mobilePage === 0 ? 'Voltar para a tela anterior' : 'Ir para Parâmetros da Corrida'}
              className={`w-full sm:hidden flex items-center justify-between gap-0.5 rounded-lg border border-[#334155] bg-[#1e293b]/90 px-1.5 py-1.5 text-[9.5px] font-mono tabular-nums transition-colors ${
                isPinLocked
                  ? 'opacity-50 pointer-events-none'
                  : 'cursor-pointer hover:border-amber-500/50 active:scale-[0.99]'
              }`}
            >
              <div className="flex flex-col items-center leading-tight">
                <span className="text-[7px] font-sans uppercase text-slate-400">Stints</span>
                <span className="font-bold text-white">{isPinLocked ? '--' : raceStintCount}</span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex flex-col items-center leading-tight">
                <span className="text-[7px] font-sans uppercase text-slate-400">Voltas</span>
                <span className="font-bold text-[#22c55e]">{isPinLocked ? '--' : totalEstimatedLaps}</span>
              </div>
              <span className="text-slate-700">|</span>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isPinLocked) goToMobileParamField(mobileSessionStartRef);
                }}
                title="Ajustar horário da sessão"
                className="flex flex-col items-center leading-tight rounded px-1 py-0.5 hover:bg-amber-500/15 active:scale-95"
              >
                <span className="text-[7px] font-sans uppercase text-slate-400">Horário</span>
                <span className="font-bold text-white">
                  {!isPinLocked && raceStints[0] ? formatMinutesToHHMM(raceStints[0].startMin) : '--:--'}→
                  {!isPinLocked && raceStints[raceStints.length - 1]
                    ? formatMinutesToHHMM(raceStints[raceStints.length - 1].endMin)
                    : '--:--'}
                </span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex flex-col items-center leading-tight">
                <span className="text-[7px] font-sans uppercase text-slate-400">Pilotos</span>
                <span className="font-bold text-[#eab308]">
                  {isPinLocked ? '--' : new Set(raceStints.map((s) => s.driver).filter((d) => d && d !== 'ND')).size}
                </span>
              </div>
              <span className="text-slate-700">|</span>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isPinLocked) goToMobileParamField(mobileAvailableTiresRef);
                }}
                title="Ajustar pneus disponíveis"
                className="flex flex-col items-center leading-tight rounded px-1 py-0.5 hover:bg-emerald-500/15 active:scale-95"
              >
                <span className="text-[7px] font-sans uppercase text-slate-400">Pneus</span>
                <span
                  className={`font-bold ${
                    isPinLocked ? 'text-slate-500' : remainingTiresCount < 0 ? 'text-red-400' : 'text-[#22c55e]'
                  }`}
                >
                  {isPinLocked ? '--/--' : `${usedTiresCount}/${availableTiresNum}`}
                </span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex flex-col items-center leading-tight">
                <span className="text-[7px] font-sans uppercase text-slate-400">
                  {telemetry.isElms ? 'Regul.' : 'Ratio'}
                </span>
                <span className="font-bold text-amber-300">
                  {isPinLocked
                    ? '--'
                    : telemetry.isElms
                    ? 'ELMS'
                    : telemetry.fuelRatio.toFixed(2)}
                </span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex flex-col items-center leading-tight">
                <span className="text-[7px] font-sans uppercase text-slate-400">Auton</span>
                <span className="font-bold text-[#22c55e]">
                  {isPinLocked ? '--' : `${telemetry.maxStintLaps}v`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* TEAM MULTI-CAR SELECTOR BAR */}
        <div
          className={`border-t border-[#334155]/80 bg-[#0b1120]/90 ${
            mobilePage === 0 && mobileParamsOpen ? 'block' : 'hidden md:block'
          } ${isPinLocked ? 'opacity-40 pointer-events-none' : ''}`}
        >
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2 px-4 py-1.5 sm:px-5">
            {/* Grupo 1: Seletor de Carros */}
            <div className="flex flex-wrap items-center gap-1.5">
              {carOrder.map((slotId, idx) => {
                const car = cars[slotId];
                if (!car) return null;
                const preset = CAR_SLOT_PRESETS[slotId] || CAR_SLOT_PRESETS['car-1'];
                const carModel =
                  LMU_CARS.find((c) => c.id === car.carParams?.carId) ||
                  LMU_CARS.find((c) => c.classId === car.carParams?.carClass) ||
                  LMU_CARS[0];
                const carClassMeta =
                  LMU_CAR_CLASSES.find((cls) => cls.id === carModel.classId) ||
                  LMU_CAR_CLASSES[0];
                const isActive = slotId === activeCar.id;
                return (
                  <div
                    key={slotId}
                    className={`group inline-flex items-center whitespace-nowrap rounded-lg border transition-all ${
                      isActive
                        ? `${preset.ringClass} shadow-sm`
                        : 'border-[#334155] bg-[#1e293b]/70 text-slate-300 hover:border-slate-500 hover:text-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveCarId(slotId)}
                      className="inline-flex items-center gap-2 whitespace-nowrap px-2.5 py-1 text-left cursor-pointer"
                      title={`Selecionar Carro #${idx + 1}: ${car.label} (${carModel.name})`}
                    >
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${preset.dotClass}`} />
                      <ManufacturerLogo brand={carModel.brand} size={20} />
                      <span className="text-[11px] font-extrabold tracking-tight whitespace-nowrap">
                        {car.label || `Carro #${idx + 1}`}
                      </span>
                      <span
                        className={`rounded border px-1 py-0.2 text-[8px] font-bold uppercase tracking-wider whitespace-nowrap ${carClassMeta.badgeClass}`}
                      >
                        {carClassMeta.label}
                      </span>
                      <span className="hidden md:inline text-[10px] text-slate-400 whitespace-nowrap">
                        {carModel.name}
                      </span>
                    </button>
                    {carOrder.length > 1 && slotId !== 'car-1' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveCar(slotId);
                        }}
                        title={`Remover ${car.label}`}
                        className="mr-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-red-500/20 hover:text-red-300 cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}

              {carOrder.length < 3 && (
                <button
                  type="button"
                  onClick={handleAddCar}
                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-dashed border-[#334155] bg-[#0f172a]/70 px-2.5 py-1 text-[11px] font-bold text-slate-300 hover:border-amber-500/60 hover:text-amber-300 transition-colors cursor-pointer"
                  title="Adicionar mais um carro da equipe (máximo 3)"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  <span>Adicionar Carro</span>
                </button>
              )}
            </div>

            {/* Grupo 2: Visão Geral FTR */}
            <div className="flex w-full md:w-auto items-center justify-end md:ml-auto">
              <button
                type="button"
                onClick={() => setOverviewModalOpen(true)}
                className="inline-flex w-full md:w-auto items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[11px] font-bold text-amber-200 hover:bg-amber-500/20 transition-colors cursor-pointer"
                title="Comparar pilotos e pitstops de todos os carros lado a lado"
              >
                <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-[#eab308]" />
                <span>Visão Geral FTR</span>
                <span className="rounded bg-amber-500/20 px-1 font-mono text-[10px] text-amber-300">
                  {carOrder.length}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <div className="relative flex flex-1 flex-col">
        {isPinLocked && (
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#0f172a]/85 p-4 backdrop-blur-md">
            <div className="w-full max-w-sm rounded-2xl border border-amber-500/45 bg-[#1e293b] p-6 shadow-2xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/15 text-[#eab308]">
                  <Radio className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
                    Acesso ao Pitwall (PIN)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Informe o PIN da equipe para visualizar e editar o planejamento.
                  </p>
                </div>
              </div>

              <form onSubmit={handleConnectLiveRoom} className="space-y-3 mt-4">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    PIN da Equipe
                  </label>
                  <input
                    type="text"
                    value={pinDraft}
                    onChange={(e) => setPinDraft(e.target.value.toUpperCase())}
                    placeholder="Digite o PIN..."
                    autoFocus
                    className="w-full rounded-xl border border-[#334155] bg-[#0f172a] px-3 py-2.5 text-sm font-mono font-bold uppercase tracking-widest text-white focus:border-[#eab308] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-[#eab308] px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer"
                >
                  Entrar na Sala
                </button>
              </form>
            </div>
          </div>
        )}

      {/* MOBILE SWIPEABLE 2-PAGE VIEW (< lg) */}
      <div
        ref={mobilePagerRef}
        onScroll={handleMobilePagerScroll}
        className={`lg:hidden flex flex-1 w-full overflow-x-auto snap-x snap-mandatory scroll-smooth ${
          isPinLocked ? 'pointer-events-none select-none opacity-0' : ''
        }`}
        style={{ scrollbarWidth: 'none' }}
      >
        {/* PAGE 1 (LEFT - SWIPE RIGHT FROM CENTER): PARAMS */}
        <div className="w-full shrink-0 snap-start px-4 py-4 space-y-4">
          <div className="rounded-xl border border-[#334155] bg-[#1e293b] overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-[#334155] bg-slate-800/80 px-4 py-3">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-[#eab308]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Parâmetros da Corrida
                </h2>
              </div>
              <button
                type="button"
                disabled={stintMode === 'race'}
                onClick={handleReset}
                title="Resetar Estratégia"
                className={`inline-flex items-center gap-1 rounded-md border border-[#334155] bg-[#0f172a] px-2 py-1 text-[11px] font-semibold text-slate-300 ${
                  stintMode === 'race'
                    ? 'opacity-40 pointer-events-none'
                    : 'hover:border-slate-500 hover:text-white cursor-pointer'
                }`}
              >
                <RotateCcw className="h-3 w-3 text-slate-400" />
                <span>Resetar</span>
              </button>
            </div>
            <div
              className={`p-4 space-y-4 transition-opacity ${
                stintMode === 'race' ? 'opacity-25 pointer-events-none select-none' : ''
              }`}
            >
              {/* Championship / Regulation Selector */}
              <div className="rounded-lg border border-[#334155] bg-[#0f172a]/70 p-2.5">
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Campeonato / Regulamento
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'WEC', label: 'WEC', sub: 'Fuel + Energia Virt.' },
                    { id: 'ELMS', label: 'ELMS', sub: 'Somente Fuel (L)' },
                  ].map((reg) => {
                    const active = (params.championship || 'WEC') === reg.id;
                    return (
                      <button
                        type="button"
                        key={reg.id}
                        onClick={() => handleParamChange('championship', reg.id)}
                        className={`rounded-md border px-2 py-1.5 text-left transition-colors cursor-pointer ${
                          active
                            ? 'border-amber-500 bg-amber-500/20 text-amber-200'
                            : 'border-[#334155] bg-[#1e293b] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="text-xs font-extrabold leading-tight">{reg.label}</div>
                        <div className="text-[9px] opacity-80 leading-tight">{reg.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Car & Class Selector */}
              <div
                ref={mobileCarTrackRef}
                className="rounded-lg border border-[#334155] bg-[#0f172a]/70 p-3 space-y-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <ManufacturerLogo brand={selectedCar.brand} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${selectedClassMeta.badgeClass}`}
                      >
                        {selectedClassMeta.label}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs font-bold leading-snug text-white">
                      {selectedCar.name}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">
                    Identificação do Carro (Aba)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={activeCar.label}
                      onChange={(e) => handleUpdateCarLabel(activeCar.id, e.target.value)}
                      placeholder="Ex: FTR #14 - Mustang GT3"
                      className="flex-1 min-w-0 rounded-md border border-[#334155] bg-[#1e293b] px-2.5 py-1.5 text-xs font-bold text-slate-100 focus:border-[#eab308] focus:outline-none"
                    />
                    {carOrder.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setCloneModalOpen(true)}
                        title="Copiar estratégia deste carro para outro carro"
                        className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[10px] font-bold text-amber-200 hover:bg-amber-500/20 cursor-pointer shrink-0"
                      >
                        <Copy className="h-3 w-3" />
                        <span>Copiar p/ outro</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">
                      Categoria
                    </label>
                    <select
                      value={params.carClass || selectedCar.classId}
                      onChange={(e) => {
                        const nextClass = e.target.value;
                        const firstCar = LMU_CARS.find((c) => c.classId === nextClass);
                        setParams((prev) => ({
                          ...prev,
                          carClass: nextClass,
                          carId: firstCar ? firstCar.id : prev.carId,
                        }));
                      }}
                      className="w-full rounded-md border border-[#334155] bg-[#1e293b] px-2 py-1.5 text-xs font-semibold text-slate-100 focus:border-[#eab308] focus:outline-none"
                    >
                      {LMU_CAR_CLASSES.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">
                      Carro
                    </label>
                    <select
                      value={selectedCar.id}
                      onChange={(e) => handleParamChange('carId', e.target.value)}
                      className="w-full rounded-md border border-[#334155] bg-[#1e293b] px-2 py-1.5 text-xs font-medium text-slate-100 focus:border-[#eab308] focus:outline-none"
                    >
                      {carsInSelectedClass.map((car) => (
                        <option key={car.id} value={car.id}>
                          {car.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-400">
                    <MapPin className="h-3 w-3 text-[#eab308]" />
                    Circuito
                  </label>
                  <button
                    type="button"
                    onClick={() => setCircuitModalOpen(true)}
                    className="w-full flex items-center justify-between gap-3 rounded-lg border border-[#334155] bg-[#1e293b] px-3 py-2 text-left cursor-pointer transition-colors hover:border-amber-500/60 hover:bg-[#1e293b]/90 active:scale-[0.99]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                        <span className="text-lg leading-none">{selectedCircuit.flag}</span>
                        <span>{selectedCircuit.shortName}</span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-400">{selectedCircuit.country}</div>
                    </div>
                    <CircuitTrackSvg
                      svgPath={selectedCircuit.svgPath}
                      spin3d={true}
                      className="h-12 w-24 shrink-0 text-[#eab308]"
                    />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <Clock className="h-3 w-3 text-[#eab308]" />
                    Início da Sessão
                  </label>
                  <input
                    ref={mobileSessionStartRef}
                    type="time"
                    value={params.sessionStart}
                    onChange={(e) => handleParamChange('sessionStart', e.target.value)}
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <Timer className="h-3 w-3 text-[#eab308]" />
                    Duração Corrida (00:00)
                  </label>
                  <FreeFormattedTextInput
                    placeholder="06:00"
                    inputMode="numeric"
                    value={params.raceDurationStr}
                    normalize={normalizeRaceDurationStr}
                    onCommit={(val) => handleParamChange('raceDurationStr', val)}
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <Gauge className="h-3 w-3 text-[#22c55e]" />
                    Tempo de Volta
                  </label>
                  <FreeFormattedTextInput
                    placeholder="01:45.320"
                    inputMode="decimal"
                    value={params.lapTimeStr}
                    normalize={normalizeLapTimeStr}
                    onCommit={(val) => handleParamChange('lapTimeStr', val)}
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <Fuel className="h-3 w-3 text-[#eab308]" />
                    Tanque (Litros)
                  </label>
                  <FreeNumericInput
                    min={1}
                    allowDecimal={false}
                    value={params.tankCapacityL}
                    onCommit={(val) => handleParamChange('tankCapacityL', val)}
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <Fuel className="h-3 w-3 text-slate-400" />
                    Consumo (L/volta)
                  </label>
                  <FreeNumericInput
                    min={0.1}
                    allowDecimal={true}
                    value={params.fuelPerLapL}
                    onCommit={(val) => handleParamChange('fuelPerLapL', val)}
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>
                {!telemetry.isElms && (
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <Zap className="h-3 w-3 text-[#22c55e]" />
                    Energia Virt. (%/v)
                  </label>
                  <FreeNumericInput
                    min={0.1}
                    allowDecimal={true}
                    value={params.virtualEnergyPerLapPct}
                    onCommit={(val) => handleParamChange('virtualEnergyPerLapPct', val)}
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>
                )}
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-400">
                    Free Practice (min)
                  </label>
                  <FreeNumericInput
                    min={0}
                    allowDecimal={false}
                    value={params.fpDurationMin}
                    onCommit={(val) => handleParamChange('fpDurationMin', val)}
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-400">
                    Qualy (min)
                  </label>
                  <FreeNumericInput
                    min={0}
                    allowDecimal={false}
                    value={params.qualyDurationMin}
                    onCommit={(val) => handleParamChange('qualyDurationMin', val)}
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 flex items-center justify-between text-[11px] font-medium text-slate-400">
                    <span className="flex items-center gap-1">
                      <Disc className="h-3 w-3 text-[#22c55e]" />
                      Pneus Disponíveis
                    </span>
                    <span
                      className={`font-mono text-[10px] ${
                        remainingTiresCount < 0 ? 'text-red-400 font-semibold' : 'text-slate-400'
                      }`}
                    >
                      Utilizados: {usedTiresCount} • Restantes: {remainingTiresCount}
                    </span>
                  </label>
                  <div className="flex items-center gap-2.5">
                    <FreeNumericInput
                      ref={mobileAvailableTiresRef}
                      min={0}
                      allowDecimal={false}
                      value={params.availableTires ?? 24}
                      onCommit={(val) => handleParamChange('availableTires', val)}
                      className="w-16 shrink-0 rounded-lg border border-[#334155] bg-[#0f172a] px-2 py-1.5 text-center text-sm font-mono font-bold tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                    />
                    <div className="flex flex-1 flex-wrap items-center gap-1">
                      {Array.from({ length: Math.min(availableTiresNum, 48) }).map((_, idx) => (
                        <MiniPirelliTire key={`m-tire-${idx}`} size={15} />
                      ))}
                      {availableTiresNum > 48 && (
                        <span className="font-mono text-[10px] font-bold text-amber-300">
                          +{availableTiresNum - 48}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#334155] pt-3">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  <Wrench className="h-3.5 w-3.5 text-[#eab308]" />
                  <span>Pitstop LMU (Dinâmico)</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-300 font-medium">Pitlane Loss (passagem)</span>
                    <div className="flex items-center gap-1">
                      <FreeNumericInput
                        min={0}
                        allowDecimal={false}
                        value={params.pitlaneLossSec ?? 30}
                        onCommit={(val) => handleParamChange('pitlaneLossSec', val)}
                        className="w-16 rounded-md border border-[#334155] bg-[#0f172a] px-2 py-1 text-right text-xs font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                      />
                      <span className="text-xs text-slate-500">s</span>
                    </div>
                  </div>
                  <p className="rounded-md border border-[#334155]/80 bg-[#0f172a]/60 px-2.5 py-1.5 text-[10px] leading-relaxed text-slate-400">
                    Vazão: 2,5{telemetry.isElms ? 'L' : '%'}/s + 3s • Pneus sequenciais:{' '}
                    <strong className="text-slate-200">
                      {params.carClass === 'LMGT3' || params.carClass === 'GTE' ? '8,5s' : '8,0s'}
                    </strong>
                    /pneu • Troca de piloto: 25s (paralela ao combustível).
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* FUEL RATIO & AUTONOMY */}
          <div className="rounded-xl border border-amber-500/40 bg-gradient-to-br from-[#1e293b] to-[#0f172a] p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#eab308]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#eab308]">
                  {telemetry.isElms ? 'Autonomia (ELMS)' : 'Fuel Ratio & Autonomia'}
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {!telemetry.isElms ? (
                <div className="rounded-lg border border-[#334155] bg-[#0f172a]/80 p-3">
                  <div className="text-[11px] text-slate-400">Fuel Ratio</div>
                  <div className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-white">
                    {telemetry.fuelRatio.toFixed(2)}
                    <span className="ml-1 text-xs font-normal text-amber-400">L/%</span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-500">
                    {params.fuelPerLapL}L ÷ {params.virtualEnergyPerLapPct}%
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-[#334155] bg-[#0f172a]/80 p-3">
                  <div className="text-[11px] text-slate-400">Tanque / Consumo</div>
                  <div className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-white">
                    {params.tankCapacityL}
                    <span className="ml-1 text-xs font-normal text-amber-400">L</span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-500">
                    {params.fuelPerLapL} L/volta
                  </div>
                </div>
              )}
              <div className="rounded-lg border border-[#334155] bg-[#0f172a]/80 p-3">
                <div className="text-[11px] text-slate-400">Autonomia Máx / Stint</div>
                <div className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-[#22c55e]">
                  {telemetry.maxStintLaps}
                  <span className="ml-1 text-xs font-normal text-emerald-300">voltas</span>
                </div>
                <div className="mt-0.5 text-[10px] font-mono text-slate-400 tabular-nums">
                  ~{telemetry.maxStintMin.toFixed(1)} min / stint
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-[#334155]/70 pt-2.5">
              <span>Tanque: {telemetry.maxLapsByFuel}v</span>
              {!telemetry.isElms && (
                <>
                  <span>•</span>
                  <span>Energia 100%: {telemetry.maxLapsByEnergy}v</span>
                </>
              )}
              <span>•</span>
              <span className="text-slate-200 font-semibold">{raceStintCount} stints</span>
            </div>
          </div>
        </div>

        {/* PAGE 2 (CENTER - DEFAULT): STINTS */}
        <div className="w-full shrink-0 snap-start px-4 py-4">
          <div className="rounded-xl border border-[#334155] bg-[#1e293b]">
            <div className="flex flex-col gap-2 rounded-t-xl border-b border-[#334155] bg-slate-800/80 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Clock className="h-4 w-4 shrink-0 text-[#eab308]" />
                  <h2 className="truncate text-xs font-bold uppercase tracking-wider text-slate-200">
                    Stints
                  </h2>
                  <div className="inline-flex items-center gap-1 rounded border border-[#334155] bg-[#0f172a]/70 px-1.5 py-0.5">
                    <CircuitTrackSvg svgPath={selectedCircuit.svgPath} className="h-4 w-7 shrink-0 text-[#38bdf8]" />
                    <span className="text-[10px] font-semibold text-slate-300 truncate max-w-[80px]">
                      {selectedCircuit.shortName}
                    </span>
                  </div>
                </div>
              </div>
              {raceDriverStats.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5">
                  {raceDriverStats.map((d) => {
                    const hrs = Math.floor(d.durationMin / 60);
                    const mins = Math.round(d.durationMin % 60);
                    const timeStr = hrs > 0 ? `${hrs}h${String(mins).padStart(2, '0')}` : `${mins}m`;
                    const firstName = d.driver.split(' ')[0];
                    return (
                      <div
                        key={`m-drv-${d.driver}`}
                        className="flex items-center gap-1.5 rounded-md border border-[#334155] bg-[#0f172a]/90 px-1.5 py-1 min-w-0"
                      >
                        <DriverAvatar90s driver={d.driver} size={20} />
                        <div className="flex flex-col leading-none min-w-0">
                          <span className="truncate text-[9px] font-bold text-slate-100">{firstName}</span>
                          <span className="truncate font-mono text-[8.5px] text-amber-300 tabular-nums">
                            {d.laps}v • {timeStr}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2.5 p-2.5 bg-[#0f172a]/70">
              {enrichedSchedule.map((row) => {
                const isCollapsed = expandedStintId !== row.id;
                const nextStintLabel = `Stint ${String((row.stintNum || 0) + 1).padStart(2, '0')}`;
                const isStintDone = stintMode === 'race' && Boolean(completedItems[row.id]);
                const isPitDone = stintMode === 'race' && Boolean(completedItems[`pit_${row.stintNum}`]);
                const cardColorClass =
                  stintMode === 'planning'
                    ? row.type === 'fp'
                      ? 'border-sky-500/35 border-l-sky-400 bg-gradient-to-br from-sky-950/55 via-[#1e293b] to-[#172033]'
                      : row.type === 'qualy'
                      ? 'border-indigo-500/45 border-l-indigo-400 bg-gradient-to-br from-indigo-950/55 via-[#1e293b] to-[#172033]'
                      : 'border-cyan-500/40 border-l-cyan-400 bg-gradient-to-br from-cyan-950/45 via-[#1e293b] to-[#172033]'
                    : row.type === 'fp'
                    ? 'border-sky-500/35 border-l-sky-400 bg-gradient-to-br from-sky-950/60 via-[#1e293b] to-[#172033]'
                    : row.type === 'qualy'
                    ? 'border-amber-500/45 border-l-[#eab308] bg-gradient-to-br from-amber-950/50 via-[#1e293b] to-[#172033]'
                    : 'border-emerald-500/45 border-l-[#22c55e] bg-gradient-to-br from-emerald-950/50 via-[#1e293b] to-[#172033]';
                const labelBadgeClass =
                  stintMode === 'planning'
                    ? row.type === 'fp'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                      : row.type === 'qualy'
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                      : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : row.type === 'fp'
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                    : row.type === 'qualy'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
                return (
                  <React.Fragment key={`m-page-${row.id}`}>
                  {row.type === 'fp' ? (
                    <div className={`flex items-center justify-between gap-2 rounded-lg border border-l-4 px-3.5 py-1.5 text-[10px] ${cardColorClass}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-block w-6 shrink-0" aria-hidden="true" />
                        <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-sky-400" />
                        <span className={`rounded border px-2 py-0.5 text-xs font-extrabold tracking-wide whitespace-nowrap ${labelBadgeClass}`}>
                          {row.label}
                        </span>
                      </div>
                      <span className="font-mono tabular-nums text-slate-300 shrink-0">
                        {formatMinutesToHHMM(row.startMin)}-{formatMinutesToHHMM(row.endMin)} • {Math.round(row.durationMin)}m ({row.laps}v)
                      </span>
                    </div>
                  ) : (
                  <div
                    onClick={(e) => {
                      if (e.target.closest('input, select, button')) return;
                      toggleStintCollapse(row.id);
                    }}
                    className={`flex items-stretch overflow-hidden rounded-xl border border-l-4 shadow-md transition-all cursor-pointer ${cardColorClass} ${isStintDone ? 'opacity-70' : ''}`}
                  >
                  <div className="flex-1 min-w-0 p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {row.type !== 'fp' && (
                          <button
                            type="button"
                            onClick={() => toggleStintCollapse(row.id)}
                            title={isCollapsed ? 'Expandir stint' : 'Minimizar stint'}
                            className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#334155] bg-[#0f172a] text-slate-400 hover:text-[#eab308]"
                          >
                            {isCollapsed ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronUp className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                        <span
                          className={`inline-flex h-2.5 w-2.5 rounded-full ${
                            row.type === 'fp'
                              ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.7)]'
                              : row.type === 'qualy'
                              ? 'bg-[#eab308] shadow-[0_0_8px_rgba(234,179,8,0.7)]'
                              : 'bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.7)]'
                          }`}
                        />
                        <div>
                          <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-extrabold tracking-wide ${labelBadgeClass}`}>{row.label}</span>
                          {isCollapsed && row.type !== 'fp' && (
                            <div className="text-[11px] font-semibold text-amber-300">
                              {row.driver}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <div className="text-xs font-bold text-slate-100">
                          {formatMinutesToHHMM(row.startMin)} - {formatMinutesToHHMM(row.endMin)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {row.durationMin.toFixed(1)} min • {row.laps} voltas
                        </div>
                      </div>
                    </div>

                    {!isCollapsed && row.type !== 'fp' && (
                    <>
                    <div className="flex items-center gap-3">
                      <DriverAvatar90s driver={row.driver} size={52} />
                      <div className="flex-1 min-w-0">
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">
                          Piloto
                        </label>
                        <select
                          value={row.driver}
                          onChange={(e) => {
                            if (row.type === 'race') {
                              updateRaceStint(row.stintNum, 'driver', e.target.value);
                            } else {
                              updatePreSession(row.type, 'driver', e.target.value);
                            }
                          }}
                          className="w-full rounded-md border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-xs text-slate-100 focus:border-[#eab308] focus:outline-none"
                        >
                          {DRIVERS.map((d) => {
                            const allowed = canAssignDriver(row.id, d);
                            return (
                              <option key={d} value={d} disabled={!allowed}>
                                {d}{!allowed ? ' (limite 6)' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>

                      <div className="space-y-3">
                        <div>
                          <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase text-slate-400">
                            <span>Pneus Início (Toque para alternar)</span>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            {TIRE_CORNERS.map(({ key }) => {
                              const tireMeta = row.startTireMeta?.[key];
                              const setStartVal = (val) => {
                                if (row.type === 'race') {
                                  updateRaceStintTire(row.stintNum, 'tiresStart', key, val);
                                } else {
                                  updatePreSessionTire(row.type, 'tiresStart', key, val);
                                }
                              };
                              return (
                                <StartTireToggleButton
                                  key={`m-p1-start-${key}`}
                                  corner={key}
                                  tireMeta={tireMeta}
                                  stintMode={stintMode}
                                  onToggle={() => setTirePitModalRowId(row.id)}
                                />
                              );
                            })}
                          </div>
                        </div>

                        {stintMode === 'race' && row.type === 'race' && (
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#334155] bg-[#0f172a]/60 px-2.5 py-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-semibold uppercase text-slate-400">
                                Duração:
                              </span>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={Math.round(row.durationMin)}
                                onChange={(e) =>
                                  updateRaceStint(
                                    row.stintNum,
                                    'durationMinOverride',
                                    Math.max(1, Number(e.target.value) || 1)
                                  )
                                }
                                className="w-14 rounded border border-[#334155] bg-[#1e293b] px-1.5 py-1 text-center font-mono text-xs font-bold text-white focus:border-[#eab308] focus:outline-none"
                              />
                              <span className="text-[10px] text-slate-400">min</span>
                              {row.isDurationOverridden && (
                                <button
                                  type="button"
                                  onClick={() => updateRaceStint(row.stintNum, 'durationMinOverride', null)}
                                  className="text-[10px] text-amber-300 underline cursor-pointer"
                                  title="Restaurar duração automática"
                                >
                                  auto
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {stintMode === 'race' && (
                        <div>
                          <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase text-slate-400">
                            <span>Pneus Fim — Borracha Restante</span>
                            {row.tiresEndEnabled && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (row.type === 'race') {
                                    updateRaceStint(row.stintNum, 'tiresEndEnabled', false);
                                  } else {
                                    updatePreSession(row.type, 'tiresEndEnabled', false);
                                  }
                                }}
                                className="inline-flex items-center gap-1 rounded border border-slate-600/70 bg-slate-800/80 px-2 py-0.5 text-[10px] font-semibold text-slate-300 transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-300"
                              >
                                × Desregistrar
                              </button>
                            )}
                          </div>
                          {!row.tiresEndEnabled ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (row.type === 'race') {
                                  updateRaceStint(row.stintNum, 'tiresEndEnabled', true);
                                } else {
                                  updatePreSession(row.type, 'tiresEndEnabled', true);
                                }
                              }}
                              className="w-full rounded-md border border-dashed border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 transition-colors hover:border-amber-400 hover:bg-amber-500/20"
                            >
                              + Registrar Desgaste de Fim de Stint
                            </button>
                          ) : (
                            <div className="grid grid-cols-4 gap-2">
                              {TIRE_CORNERS.map(({ key }) => (
                                <TireBadgeEditor
                                  key={`m-p1-end-${key}`}
                                  corner={key}
                                  tireId={row.endTireMeta?.[key]?.tireId}
                                  value={row.tiresEnd[key]}
                                  onChange={(val) => {
                                    if (row.type === 'race') {
                                      updateRaceStintTire(row.stintNum, 'tiresEnd', key, val);
                                    } else {
                                      updatePreSessionTire(row.type, 'tiresEnd', key, val);
                                    }
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        )}
                      </div>
                    </>
                    )}
                  </div>
                  {stintMode === 'race' && (
                    <CheckeredStripButton
                      done={isStintDone}
                      onToggle={() => toggleCompletedItem(row.id)}
                      roundedClass="rounded-r-xl"
                    />
                  )}
                  </div>
                  )}

                  {row.type === 'race' && !row.isLastStint && (
                    <div
                      className={`flex items-stretch overflow-hidden rounded-lg border transition-all ${
                        stintMode === 'planning'
                          ? 'border-indigo-500/40 bg-indigo-500/10'
                          : 'border-amber-500/35 bg-amber-500/10'
                      } ${isPitDone ? 'opacity-70' : ''}`}
                    >
                      <div className="flex flex-1 min-w-0 items-center justify-between gap-1.5 px-2 py-1">
                      <div className="flex items-center gap-1.5 min-w-0 text-[10px] overflow-hidden">
                        <Wrench className={`h-3 w-3 shrink-0 ${stintMode === 'planning' ? 'text-indigo-300' : 'text-[#eab308]'}`} />
                        <span className={`font-bold whitespace-nowrap ${stintMode === 'planning' ? 'text-indigo-300' : 'text-[#eab308]'}`}>
                          P{String(row.stintNum).padStart(2, '0')}→{String((row.stintNum || 0) + 1).padStart(2, '0')}
                        </span>
                        <span className="font-mono font-bold text-emerald-300 truncate">
                          {row.mfdTargetLabel}
                        </span>
                        <span className="font-mono text-amber-300 whitespace-nowrap">
                          • {row.pitStationarySec.toFixed(1)}s
                        </span>
                      </div>
                      <select
                        value={row.pitScenario}
                        onChange={(e) =>
                          updateRaceStint(row.stintNum, 'pitScenario', e.target.value)
                        }
                        className={`shrink-0 max-w-[128px] rounded border bg-[#0f172a] px-1.5 py-0.5 text-[10px] text-slate-100 focus:outline-none ${
                          stintMode === 'planning'
                            ? 'border-indigo-500/40 focus:border-indigo-400'
                            : 'border-amber-500/35 focus:border-[#eab308]'
                        }`}
                      >
                        {PIT_SCENARIOS.map((sc) => (
                          <option key={sc.id} value={sc.id}>
                            {sc.label} (
                            {calculatePitStopDetails({
                              scenarioId: sc.id,
                              params,
                              carClass: params.carClass || 'LMGT3',
                              nextStintLaps: row.nextStintLaps,
                              remainingFuelL: row.remainingFuelL,
                              remainingEnergyPct: row.remainingEnergyPct,
                              hasDriverSwap: row.hasDriverSwap,
                            }).stationarySec.toFixed(1)}
                            s)
                          </option>
                        ))}
                      </select>
                      </div>
                      {stintMode === 'race' && (
                        <CheckeredStripButton
                          done={isPitDone}
                          onToggle={() => toggleCompletedItem(`pit_${row.stintNum}`)}
                          roundedClass="rounded-r-lg"
                        />
                      )}
                    </div>
                  )}
                  </React.Fragment>
                );
              })}
            </div>
            {stintMode === 'planning' ? (
              <div className="flex flex-col sm:flex-row gap-2 border-t border-[#334155] bg-slate-800/60 p-3">
                <button
                  type="button"
                  onClick={handleClearPlanning}
                  className="w-full sm:w-auto rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-red-300 transition-colors hover:bg-red-500/20 cursor-pointer"
                >
                  Limpar Planejamento
                </button>
                <button
                  type="button"
                  onClick={handleExportPlanningToRace}
                  className="w-full flex-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#22c55e] transition-colors hover:bg-emerald-500/25 cursor-pointer"
                >
                  Exportar Planejamento para Corrida
                </button>
              </div>
            ) : (
              <div className="border-t border-[#334155] bg-slate-800/60 p-3">
                <button
                  type="button"
                  onClick={handleClearRace}
                  className="w-full rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-red-300 transition-colors hover:bg-red-500/20 cursor-pointer"
                >
                  Limpar Dados da Corrida
                </button>
              </div>
            )}
          </div>
        </div>

        {/* PAGE 3 (SWIPE LEFT FROM CENTER): TIRE MANAGER, FUEL RATIO & CALENDAR */}
        <div className="w-full shrink-0 snap-start px-4 py-4 space-y-4">
          {/* TIRE MANAGER */}
          <div
            className={`rounded-xl border border-[#334155] bg-[#1e293b] p-4 transition-opacity ${
              stintMode === 'planning' ? 'opacity-25 pointer-events-none select-none' : ''
            }`}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Disc className="h-4 w-4 text-[#22c55e]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Gerenciador de Pneus — Melhores para Reaproveitar
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {TIRE_CORNERS.map(({ key, label }) => {
                const rec = tireRecommendations[key];
                const best = rec?.best;
                const second = rec?.secondBest;
                return (
                  <button
                    type="button"
                    key={`m-p2-tm-${key}`}
                    onClick={() => setSelectedTireCornerModal(key)}
                    title={`Ver todos os pneus usados em ${key} (${label})`}
                    className="w-full text-left rounded-lg border border-[#334155] bg-[#0f172a]/90 p-3.5 flex flex-col justify-between cursor-pointer transition-colors hover:border-emerald-500/50 hover:bg-[#0f172a] active:scale-[0.99]"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-200">
                          {key} <span className="font-normal text-slate-400">({label})</span>
                        </span>
                        <span className="rounded bg-emerald-500/15 border border-emerald-500/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#22c55e]">
                          SUGERIDO
                        </span>
                      </div>
                      {best ? (
                        <>
                          <div className="mt-2.5 flex items-baseline justify-between">
                            <span
                              className={`text-2xl font-extrabold font-mono tabular-nums ${getTireTextColor(
                                best.pct
                              )}`}
                            >
                              {best.pct}%
                            </span>
                            <span className="text-xs font-medium text-slate-300">
                              <span className="font-mono font-bold text-amber-300 mr-1">
                                {best.tireId}
                              </span>
                              ({best.sourceLabel})
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                            <div
                              className={`h-full transition-all ${getTireBarColor(best.pct)}`}
                              style={{ width: `${best.pct}%` }}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>Sem dados</span>
                        </div>
                      )}
                    </div>
                    {second && (
                      <div className="mt-3 border-t border-[#334155]/70 pt-2 flex items-center justify-between text-[11px] text-slate-400">
                        <span>2ª melhor opção:</span>
                        <span className="font-mono tabular-nums text-slate-300">
                          {second.pct}% ({second.tireId} • {second.sourceLabel})
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div ref={mobileCalendarRef}>{calendarCard}</div>
        </div>
      </div>

      {/* DESKTOP 2-COLUMN WORKSPACE (lg+) */}
      <main
        className={`hidden lg:flex mx-auto w-full max-w-[1600px] flex-1 flex-row gap-5 p-6 ${
          isPinLocked ? 'pointer-events-none select-none opacity-0' : ''
        }`}
      >
        {/* LEFT SIDEBAR: PARAMETERS & CALENDAR */}
        <aside className="w-full shrink-0 space-y-4 lg:w-[320px] xl:w-[340px]">
          {/* Mobile Collapse Toggle for Parameters */}
          <div className="rounded-xl border border-[#334155] bg-[#1e293b] overflow-hidden">
            <button
              type="button"
              onClick={() => setMobileParamsOpen((prev) => !prev)}
              className="flex w-full items-center justify-between border-b border-[#334155] bg-slate-800/80 px-4 py-3 text-left lg:cursor-default"
            >
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-[#eab308]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Parâmetros da Corrida
                </h2>
              </div>
              <span className="lg:hidden text-slate-400">
                {mobileParamsOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </span>
            </button>

            <div
              className={`${mobileParamsOpen ? 'block' : 'hidden'} lg:block p-4 space-y-4 transition-opacity ${
                stintMode === 'race' ? 'opacity-25 pointer-events-none select-none' : ''
              }`}
            >
              {/* Championship / Regulation Selector */}
              <div className="rounded-lg border border-[#334155] bg-[#0f172a]/70 p-2.5">
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Campeonato / Regulamento
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'WEC', label: 'WEC', sub: 'Fuel + Energia Virt.' },
                    { id: 'ELMS', label: 'ELMS', sub: 'Somente Fuel (L)' },
                  ].map((reg) => {
                    const active = (params.championship || 'WEC') === reg.id;
                    return (
                      <button
                        type="button"
                        key={reg.id}
                        onClick={() => handleParamChange('championship', reg.id)}
                        className={`rounded-md border px-2 py-1.5 text-left transition-colors cursor-pointer ${
                          active
                            ? 'border-amber-500 bg-amber-500/20 text-amber-200'
                            : 'border-[#334155] bg-[#1e293b] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="text-xs font-extrabold leading-tight">{reg.label}</div>
                        <div className="text-[9px] opacity-80 leading-tight">{reg.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Car & Class Selector */}
              <div className="rounded-lg border border-[#334155] bg-[#0f172a]/70 p-3 space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <ManufacturerLogo brand={selectedCar.brand} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${selectedClassMeta.badgeClass}`}
                      >
                        {selectedClassMeta.label}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs font-bold leading-snug text-white">
                      {selectedCar.name}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">
                    Identificação do Carro (Aba)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={activeCar.label}
                      onChange={(e) => handleUpdateCarLabel(activeCar.id, e.target.value)}
                      placeholder="Ex: FTR #14 - Mustang GT3"
                      className="flex-1 min-w-0 rounded-md border border-[#334155] bg-[#1e293b] px-2.5 py-1.5 text-xs font-bold text-slate-100 focus:border-[#eab308] focus:outline-none"
                    />
                    {carOrder.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setCloneModalOpen(true)}
                        title="Copiar estratégia deste carro para outro carro"
                        className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[10px] font-bold text-amber-200 hover:bg-amber-500/20 cursor-pointer shrink-0"
                      >
                        <Copy className="h-3 w-3" />
                        <span>Copiar p/ outro</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">
                      Categoria
                    </label>
                    <select
                      value={params.carClass || selectedCar.classId}
                      onChange={(e) => {
                        const nextClass = e.target.value;
                        const firstCar = LMU_CARS.find((c) => c.classId === nextClass);
                        setParams((prev) => ({
                          ...prev,
                          carClass: nextClass,
                          carId: firstCar ? firstCar.id : prev.carId,
                        }));
                      }}
                      className="w-full rounded-md border border-[#334155] bg-[#1e293b] px-2 py-1.5 text-xs font-semibold text-slate-100 focus:border-[#eab308] focus:outline-none cursor-pointer"
                    >
                      {LMU_CAR_CLASSES.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">
                      Carro
                    </label>
                    <select
                      value={selectedCar.id}
                      onChange={(e) => handleParamChange('carId', e.target.value)}
                      className="w-full rounded-md border border-[#334155] bg-[#1e293b] px-2 py-1.5 text-xs font-medium text-slate-100 focus:border-[#eab308] focus:outline-none cursor-pointer"
                    >
                      {carsInSelectedClass.map((car) => (
                        <option key={car.id} value={car.id}>
                          {car.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-400">
                    <MapPin className="h-3 w-3 text-[#eab308]" />
                    Circuito
                  </label>
                  <button
                    type="button"
                    onClick={() => setCircuitModalOpen(true)}
                    className="w-full flex items-center justify-between gap-3 rounded-lg border border-[#334155] bg-[#1e293b] px-3 py-2 text-left cursor-pointer transition-colors hover:border-amber-500/60 hover:bg-[#1e293b]/90 active:scale-[0.99]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                        <span className="text-lg leading-none">{selectedCircuit.flag}</span>
                        <span>{selectedCircuit.shortName}</span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-400">{selectedCircuit.country}</div>
                    </div>
                    <CircuitTrackSvg
                      svgPath={selectedCircuit.svgPath}
                      spin3d={true}
                      className="h-12 w-24 shrink-0 text-[#eab308]"
                    />
                  </button>
                </div>
              </div>

              {/* Grid of Main Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <Clock className="h-3 w-3 text-[#eab308]" />
                    Início da Sessão
                  </label>
                  <input
                    type="time"
                    value={params.sessionStart}
                    onChange={(e) => handleParamChange('sessionStart', e.target.value)}
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <Timer className="h-3 w-3 text-[#eab308]" />
                    Duração Corrida (00:00)
                  </label>
                  <FreeFormattedTextInput
                    placeholder="06:00"
                    inputMode="numeric"
                    value={params.raceDurationStr}
                    normalize={normalizeRaceDurationStr}
                    onCommit={(val) => handleParamChange('raceDurationStr', val)}
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <Gauge className="h-3 w-3 text-[#22c55e]" />
                    Tempo de Volta
                  </label>
                  <FreeFormattedTextInput
                    placeholder="01:45.320"
                    inputMode="decimal"
                    value={params.lapTimeStr}
                    normalize={normalizeLapTimeStr}
                    onCommit={(val) => handleParamChange('lapTimeStr', val)}
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <Fuel className="h-3 w-3 text-[#eab308]" />
                    Tanque (Litros)
                  </label>
                  <FreeNumericInput
                    min={1}
                    allowDecimal={false}
                    value={params.tankCapacityL}
                    onCommit={(val) => handleParamChange('tankCapacityL', val)}
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <Fuel className="h-3 w-3 text-slate-400" />
                    Consumo (L/volta)
                  </label>
                  <FreeNumericInput
                    min={0.1}
                    allowDecimal={true}
                    value={params.fuelPerLapL}
                    onCommit={(val) => handleParamChange('fuelPerLapL', val)}
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>

                {!telemetry.isElms && (
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <Zap className="h-3 w-3 text-[#22c55e]" />
                    Energia Virt. (%/v)
                  </label>
                  <FreeNumericInput
                    min={0.1}
                    allowDecimal={true}
                    value={params.virtualEnergyPerLapPct}
                    onCommit={(val) => handleParamChange('virtualEnergyPerLapPct', val)}
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>
                )}

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-400">
                    Free Practice (min)
                  </label>
                  <FreeNumericInput
                    min={0}
                    allowDecimal={false}
                    value={params.fpDurationMin}
                    onCommit={(val) => handleParamChange('fpDurationMin', val)}
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-400">
                    Qualy (min)
                  </label>
                  <FreeNumericInput
                    min={0}
                    allowDecimal={false}
                    value={params.qualyDurationMin}
                    onCommit={(val) => handleParamChange('qualyDurationMin', val)}
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="mb-1 flex items-center justify-between text-[11px] font-medium text-slate-400">
                    <span className="flex items-center gap-1">
                      <Disc className="h-3 w-3 text-[#22c55e]" />
                      Pneus Disponíveis
                    </span>
                    <span
                      className={`font-mono text-[10px] ${remainingTiresCount < 0 ? 'text-red-400 font-semibold' : 'text-slate-400'
                        }`}
                    >
                      Utilizados: {usedTiresCount} • Restantes: {remainingTiresCount}
                    </span>
                  </label>
                  <div className="flex items-center gap-2.5">
                    <FreeNumericInput
                      min={0}
                      allowDecimal={false}
                      value={params.availableTires ?? 24}
                      onCommit={(val) => handleParamChange('availableTires', val)}
                      className="w-16 shrink-0 rounded-lg border border-[#334155] bg-[#0f172a] px-2 py-1.5 text-center text-sm font-mono font-bold tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                    />
                    <div className="flex flex-1 flex-wrap items-center gap-1">
                      {Array.from({ length: Math.min(availableTiresNum, 48) }).map((_, idx) => (
                        <MiniPirelliTire key={`d-tire-${idx}`} size={15} />
                      ))}
                      {availableTiresNum > 48 && (
                        <span className="font-mono text-[10px] font-bold text-amber-300">
                          +{availableTiresNum - 48}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Pitstop Times */}
              <div className="border-t border-[#334155] pt-3">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  <Wrench className="h-3.5 w-3.5 text-[#eab308]" />
                  <span>Pitstop LMU (Dinâmico)</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-300 font-medium">Pitlane Loss (passagem)</span>
                    <div className="flex items-center gap-1">
                      <FreeNumericInput
                        min={0}
                        allowDecimal={false}
                        value={params.pitlaneLossSec ?? 30}
                        onCommit={(val) => handleParamChange('pitlaneLossSec', val)}
                        className="w-16 rounded-md border border-[#334155] bg-[#0f172a] px-2 py-1 text-right text-xs font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                      />
                      <span className="text-xs text-slate-500">s</span>
                    </div>
                  </div>
                  <p className="rounded-md border border-[#334155]/80 bg-[#0f172a]/60 px-2.5 py-1.5 text-[10px] leading-relaxed text-slate-400">
                    Vazão: 2,5{telemetry.isElms ? 'L' : '%'}/s + 3s • Pneus sequenciais:{' '}
                    <strong className="text-slate-200">
                      {params.carClass === 'LMGT3' || params.carClass === 'GTE' ? '8,5s' : '8,0s'}
                    </strong>
                    /pneu • Troca de piloto: 25s (paralela ao combustível).
                  </p>
                </div>
              </div>

              <div className="border-t border-[#334155] pt-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-500 hover:text-white cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                  <span>Resetar Estratégia</span>
                </button>
              </div>
            </div>
          </div>

          {/* HIGHLIGHT CARD: FUEL RATIO & AUTONOMY */}
          <div className="rounded-xl border border-amber-500/40 bg-gradient-to-br from-[#1e293b] to-[#0f172a] p-4 shadow-lg">
            <button
              type="button"
              onClick={() => setMobileFuelOpen((prev) => !prev)}
              className="flex w-full items-center justify-between text-left lg:cursor-default"
            >
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#eab308]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#eab308]">
                  {telemetry.isElms ? 'Autonomia (ELMS)' : 'Fuel Ratio & Autonomia'}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="lg:hidden text-slate-400">
                  {mobileFuelOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </span>
              </div>
            </button>

            {!mobileFuelOpen && (
              <div className="mt-2 flex items-center justify-between text-xs font-mono tabular-nums lg:hidden">
                {!telemetry.isElms && (
                  <span className="font-bold text-white">
                    {telemetry.fuelRatio.toFixed(2)} <span className="text-amber-400 font-normal">L/%</span>
                  </span>
                )}
                <span className="font-bold text-[#22c55e]">
                  {telemetry.maxStintLaps}v (~{telemetry.maxStintMin.toFixed(1)}m)
                </span>
                <span className="text-slate-300">{raceStintCount} stints</span>
              </div>
            )}

            <div className={`${mobileFuelOpen ? 'block' : 'hidden'} lg:block mt-3`}>
              <div className="grid grid-cols-2 gap-3">
                {!telemetry.isElms ? (
                  <div className="rounded-lg border border-[#334155] bg-[#0f172a]/80 p-3">
                    <div className="text-[11px] text-slate-400">Fuel Ratio</div>
                    <div className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-white">
                      {telemetry.fuelRatio.toFixed(2)}
                      <span className="ml-1 text-xs font-normal text-amber-400">L/%</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-500">
                      {params.fuelPerLapL}L ÷ {params.virtualEnergyPerLapPct}%
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-[#334155] bg-[#0f172a]/80 p-3">
                    <div className="text-[11px] text-slate-400">Tanque / Consumo</div>
                    <div className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-white">
                      {params.tankCapacityL}
                      <span className="ml-1 text-xs font-normal text-amber-400">L</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-500">
                      {params.fuelPerLapL} L/volta
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-[#334155] bg-[#0f172a]/80 p-3">
                  <div className="text-[11px] text-slate-400">Autonomia Máx / Stint</div>
                  <div className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-[#22c55e]">
                    {telemetry.maxStintLaps}
                    <span className="ml-1 text-xs font-normal text-emerald-300">voltas</span>
                  </div>
                  <div className="mt-0.5 text-[10px] font-mono text-slate-400 tabular-nums">
                    ~{telemetry.maxStintMin.toFixed(1)} min / stint
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-[#334155]/70 pt-2.5">
                <span>Tanque: {telemetry.maxLapsByFuel}v</span>
                {!telemetry.isElms && (
                  <>
                    <span>•</span>
                    <span>Energia 100%: {telemetry.maxLapsByEnergy}v</span>
                  </>
                )}
                <span>•</span>
                <span className="text-slate-200 font-semibold">{raceStintCount} stints</span>
              </div>
            </div>
          </div>

          {/* BOTTOM CARD: LMU CALENDAR Q3/Q4 2026 (Desktop Sidebar) */}
          <div ref={desktopCalendarRef} className="hidden lg:block">{calendarCard}</div>
        </aside>

        {/* RIGHT MAIN AREA: STINTS TABLE & TIRE MANAGER */}
        <section className="flex-1 min-w-0 space-y-5">
          {/* SUMMARY BAR (Desktop / Tablet) */}
          <div className="hidden sm:grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
            <div className="rounded-xl border border-[#334155] bg-[#1e293b] px-4 py-3">
              <div className="text-[11px] text-slate-400">Stints de Corrida</div>
              <div className="mt-0.5 text-xl font-bold font-mono tabular-nums text-white">
                {raceStintCount}
              </div>
            </div>
            <div className="rounded-xl border border-[#334155] bg-[#1e293b] px-4 py-3">
              <div className="text-[11px] text-slate-400">Voltas Estimadas</div>
              <div className="mt-0.5 text-xl font-bold font-mono tabular-nums text-[#22c55e]">
                {totalEstimatedLaps}
              </div>
            </div>
            <div className="rounded-xl border border-[#334155] bg-[#1e293b] px-4 py-3">
              <div className="text-[11px] text-slate-400">Início → Término</div>
              <div className="mt-0.5 text-base font-bold font-mono tabular-nums text-white sm:text-lg">
                {raceStints[0] ? formatMinutesToHHMM(raceStints[0].startMin) : '--:--'} →{' '}
                {raceStints[raceStints.length - 1]
                  ? formatMinutesToHHMM(raceStints[raceStints.length - 1].endMin)
                  : '--:--'}
              </div>
            </div>
            <div className="rounded-xl border border-[#334155] bg-[#1e293b] px-4 py-3">
              <div className="text-[11px] text-slate-400">Pilotos Ativos</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xl font-bold font-mono tabular-nums text-[#eab308]">
                <Users className="h-4 w-4" />
                <span>{new Set(raceStints.map((s) => s.driver).filter((d) => d && d !== 'ND')).size}</span>
              </div>
            </div>
            <div
              className={`col-span-2 sm:col-span-1 rounded-xl border px-4 py-3 ${remainingTiresCount < 0
                ? 'border-red-500/50 bg-red-500/10'
                : 'border-[#334155] bg-[#1e293b]'
                }`}
            >
              <div className="text-[11px] text-slate-400">Pneus Utilizados</div>
              <div
                className={`mt-0.5 flex items-baseline gap-1.5 text-xl font-bold font-mono tabular-nums ${remainingTiresCount < 0 ? 'text-red-400' : 'text-[#22c55e]'
                  }`}
              >
                <span>{usedTiresCount}</span>
                <span className="text-xs font-normal text-slate-400">
                  / {availableTiresNum} disp.
                </span>
              </div>
            </div>
          </div>

          {/* STINTS SCHEDULE PANEL */}
          <div className="rounded-xl border border-[#334155] bg-[#1e293b]">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-xl border-b border-[#334155] bg-slate-800/80 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 text-[#eab308]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Stints
                </h2>
                <div className="inline-flex items-center gap-1.5 rounded-md border border-[#334155] bg-[#0f172a]/70 px-2 py-0.5">
                  <CircuitTrackSvg svgPath={selectedCircuit.svgPath} className="h-5 w-9 shrink-0 text-[#38bdf8]" />
                  <span className="text-[11px] font-semibold text-slate-300">
                    {selectedCircuit.flag} {selectedCircuit.shortName}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden xl:inline text-[11px] text-slate-400">
                  Clique nos badges de pneus (<span className="font-mono text-slate-200">FL/FR/RL/RR</span>) para editar
                </span>
              </div>
            </div>

            {/* DESKTOP TABLE (md+) */}
            <div className="hidden md:block">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#334155] bg-[#0f172a]/70 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-3 py-2.5">Stint</th>
                    <th className="px-2 py-2.5 text-center">Duração</th>
                    <th className="px-2 py-2.5 text-center">Voltas</th>
                    <th className="px-2 py-2.5 text-center">Piloto</th>
                    <th className="px-2 py-2.5 text-center">Pneus Início</th>
                    <th className="px-3 py-2.5 text-center">Pneus Fim</th>
                    {stintMode === 'race' && <th className="w-4 p-0" title="Concluído" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#334155]/60">
                  {enrichedSchedule.map((row) => {
                    const isCollapsed = expandedStintId !== row.id;
                    const nextStintLabel = `Stint ${String((row.stintNum || 0) + 1).padStart(2, '0')}`;
                    const isStintDone = stintMode === 'race' && Boolean(completedItems[row.id]);
                    const isPitDone = stintMode === 'race' && Boolean(completedItems[`pit_${row.stintNum}`]);
                    const rowAccentClass =
                      stintMode === 'planning'
                        ? row.type === 'fp'
                          ? 'border-l-4 border-l-sky-400 bg-sky-950/20 hover:bg-sky-950/35'
                          : row.type === 'qualy'
                          ? 'border-l-4 border-l-indigo-400 bg-indigo-950/25 hover:bg-indigo-950/40'
                          : 'border-l-4 border-l-cyan-400 bg-cyan-950/20 hover:bg-cyan-950/35'
                        : row.type === 'fp'
                        ? 'border-l-4 border-l-sky-400 bg-sky-950/20 hover:bg-sky-950/35'
                        : row.type === 'qualy'
                        ? 'border-l-4 border-l-[#eab308] bg-amber-950/20 hover:bg-amber-950/35'
                        : 'border-l-4 border-l-[#22c55e] bg-emerald-950/15 hover:bg-emerald-950/30';
                    const labelBadgeClass =
                      stintMode === 'planning'
                        ? row.type === 'fp'
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                          : row.type === 'qualy'
                          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                          : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : row.type === 'fp'
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                        : row.type === 'qualy'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
                    return (
                      <React.Fragment key={row.id}>
                        {row.type === 'fp' ? (
                          <tr className={`transition-colors ${rowAccentClass}`}>
                            <td colSpan={stintMode === 'race' ? 7 : 6} className="px-3 py-1.5">
                              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                <span className="inline-block w-5 shrink-0" aria-hidden="true" />
                                <span className="inline-flex h-2 w-2 rounded-full bg-sky-400" />
                                <span className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${labelBadgeClass}`}>
                                  {row.label}
                                </span>
                                <span className="font-mono tabular-nums text-[11px] text-slate-400">
                                  {formatMinutesToHHMM(row.startMin)}-{formatMinutesToHHMM(row.endMin)}
                                </span>
                                <span className="text-slate-600">•</span>
                                <span className="font-mono text-[11px] text-slate-300">
                                  {Math.round(row.durationMin)} min ({row.laps}v)
                                </span>
                              </div>
                            </td>
                          </tr>
                        ) : isCollapsed ? (
                          <tr
                            onClick={(e) => {
                              if (e.target.closest('input, select, button')) return;
                              toggleStintCollapse(row.id);
                            }}
                            className={`transition-colors cursor-pointer ${rowAccentClass}`}
                          >
                            <td colSpan={6} className="px-3 py-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2.5 text-xs">
                                  <button
                                    type="button"
                                    onClick={() => toggleStintCollapse(row.id)}
                                    title="Expandir stint"
                                    className="inline-flex h-5 w-5 items-center justify-center rounded border border-[#334155] bg-[#0f172a] text-slate-400 hover:border-[#eab308]/60 hover:text-[#eab308] cursor-pointer"
                                  >
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  </button>
                                  <span
                                    className={`inline-flex h-2 w-2 rounded-full ${row.type === 'fp'
                                      ? 'bg-sky-400'
                                      : row.type === 'qualy'
                                        ? 'bg-[#eab308]'
                                        : 'bg-[#22c55e]'
                                      }`}
                                  />
                                  <span className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${labelBadgeClass}`}>{row.label}</span>
                                  <span className="font-mono tabular-nums text-[11px] text-slate-400">
                                    {formatMinutesToHHMM(row.startMin)} - {formatMinutesToHHMM(row.endMin)}
                                  </span>
                                  <span className="text-slate-600">•</span>
                                  <span className="font-mono text-[11px] text-slate-300">
                                    {row.durationMin.toFixed(1)} min ({row.laps} v)
                                  </span>
                                  <span className="text-slate-600">•</span>
                                  <span className="font-semibold text-amber-300">{row.driver}</span>
                                </div>
                                {row.type === 'race' && !row.isLastStint && (
                                  <span className="font-mono text-[11px] text-amber-400/90">
                                    {row.mfdTargetLabel} • Pit: {row.pitStationarySec.toFixed(1)}s (+{row.pitlaneLossSec}s)
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <>
                            <tr
                              onClick={(e) => {
                                if (e.target.closest('input, select, button')) return;
                                toggleStintCollapse(row.id);
                              }}
                              className={`transition-colors cursor-pointer ${rowAccentClass}`}
                            >
                              {/* STINT + HORÁRIO */}
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleStintCollapse(row.id)}
                                    title="Minimizar stint"
                                    className="inline-flex h-5 w-5 items-center justify-center rounded border border-[#334155] bg-[#0f172a] text-slate-400 hover:border-[#eab308]/60 hover:text-[#eab308] cursor-pointer"
                                  >
                                    <ChevronUp className="h-3.5 w-3.5" />
                                  </button>
                                  <span
                                    className={`inline-flex h-2 w-2 rounded-full ${row.type === 'fp'
                                      ? 'bg-sky-400'
                                      : row.type === 'qualy'
                                        ? 'bg-[#eab308]'
                                        : 'bg-[#22c55e]'
                                      }`}
                                  />
                                  <span className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${labelBadgeClass}`}>{row.label}</span>
                                </div>
                                <div className="mt-0.5 pl-9 font-mono tabular-nums text-[11px] text-slate-400">
                                  {formatMinutesToHHMM(row.startMin)} - {formatMinutesToHHMM(row.endMin)}
                                  {row.type === 'race' && !row.isLastStint && (
                                    <span className="ml-1.5 text-amber-400/90">
                                      ({row.mfdTargetLabel} • Pit: {row.pitStationarySec.toFixed(1)}s)
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* DURAÇÃO */}
                              <td className="px-2 py-2.5 whitespace-nowrap font-mono tabular-nums text-center">
                                {row.type === 'fp' ? (
                                  <div className="inline-flex items-center gap-1">
                                    <input
                                      type="number"
                                      min="0"
                                      value={params.fpDurationMin}
                                      onChange={(e) =>
                                        handleParamChange(
                                          'fpDurationMin',
                                          Math.max(0, Number(e.target.value) || 0)
                                        )
                                      }
                                      className="w-14 rounded border border-[#334155] bg-[#0f172a] px-1.5 py-1 text-xs text-slate-100 focus:border-[#eab308] focus:outline-none"
                                    />
                                    <span className="text-slate-400">min</span>
                                  </div>
                                ) : row.type === 'qualy' ? (
                                  <div className="inline-flex items-center gap-1">
                                    <input
                                      type="number"
                                      min="0"
                                      value={params.qualyDurationMin}
                                      onChange={(e) =>
                                        handleParamChange(
                                          'qualyDurationMin',
                                          Math.max(0, Number(e.target.value) || 0)
                                        )
                                      }
                                      className="w-14 rounded border border-[#334155] bg-[#0f172a] px-1.5 py-1 text-xs text-slate-100 focus:border-[#eab308] focus:outline-none"
                                    />
                                    <span className="text-slate-400">min</span>
                                  </div>
                                ) : stintMode === 'race' ? (
                                  <div className="inline-flex items-center gap-1">
                                    <input
                                      type="number"
                                      min="1"
                                      step="1"
                                      value={Math.round(row.durationMin)}
                                      onChange={(e) =>
                                        updateRaceStint(
                                          row.stintNum,
                                          'durationMinOverride',
                                          Math.max(1, Number(e.target.value) || 1)
                                        )
                                      }
                                      className="w-14 rounded border border-[#334155] bg-[#0f172a] px-1.5 py-1 text-center text-xs text-slate-100 focus:border-[#eab308] focus:outline-none"
                                    />
                                    <span className="text-slate-400">min</span>
                                    {row.isDurationOverridden && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateRaceStint(row.stintNum, 'durationMinOverride', null)
                                        }
                                        className="text-[10px] text-amber-300 underline cursor-pointer"
                                        title="Restaurar duração automática"
                                      >
                                        auto
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-200">{row.durationMin.toFixed(1)} min</span>
                                )}
                              </td>

                              {/* VOLTAS */}
                              <td className="px-2 py-2.5 whitespace-nowrap font-mono tabular-nums text-slate-200 text-center">
                                {row.laps} v
                              </td>

                              {/* PILOTO */}
                              <td className="px-2 py-2.5 text-center">
                                {row.type === 'fp' ? (
                                  <span className="inline-flex items-center rounded border border-[#334155] bg-[#0f172a]/60 px-2.5 py-1 text-[11px] text-slate-400">
                                    Sessão Livre
                                  </span>
                                ) : (
                                <div className="mx-auto flex flex-col items-center gap-1.5">
                                  <DriverAvatar90s driver={row.driver} size={48} />
                                  <select
                                    value={row.driver}
                                    onChange={(e) => {
                                      if (row.type === 'race') {
                                        updateRaceStint(row.stintNum, 'driver', e.target.value);
                                      } else {
                                        updatePreSession(row.type, 'driver', e.target.value);
                                      }
                                    }}
                                    className="w-full max-w-[140px] rounded-md border border-[#334155] bg-[#0f172a] px-2 py-1 text-xs font-medium text-slate-100 focus:border-[#eab308] focus:outline-none cursor-pointer"
                                  >
                                    {DRIVERS.map((d) => {
                                      const allowed = canAssignDriver(row.id, d);
                                      return (
                                        <option key={d} value={d} disabled={!allowed}>
                                          {d}{!allowed ? ' (limite 6)' : ''}
                                        </option>
                                      );
                                    })}
                                  </select>
                                </div>
                                )}
                              </td>

                              {/* PNEUS INÍCIO */}
                              <td className="px-2 py-2.5 whitespace-nowrap">
                                {row.type === 'fp' ? (
                                  <div className="flex justify-center">
                                    <span className="inline-flex items-center rounded border border-[#334155] bg-[#0f172a]/60 px-2.5 py-1 text-[11px] text-slate-400">
                                      Sem desgaste
                                    </span>
                                  </div>
                                ) : (
                                  <div className="mx-auto flex flex-col items-center gap-1">
                                    <div className="mx-auto grid w-[132px] grid-cols-2 gap-1.5">
                                      {TIRE_CORNERS.map(({ key }) => {
                                        const tireMeta = row.startTireMeta?.[key];
                                        const setStartVal = (val) => {
                                          if (row.type === 'race') {
                                            updateRaceStintTire(row.stintNum, 'tiresStart', key, val);
                                          } else {
                                            updatePreSessionTire(row.type, 'tiresStart', key, val);
                                          }
                                        };
                                        return (
                                          <StartTireToggleButton
                                            key={`start-${key}`}
                                            corner={key}
                                            tireMeta={tireMeta}
                                            stintMode={stintMode}
                                            onToggle={() => setTirePitModalRowId(row.id)}
                                          />
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </td>

                              {/* PNEUS FIM */}
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                {stintMode === 'planning' ? (
                                  <div className="flex justify-center">
                                    <span className="inline-flex items-center rounded border border-[#334155] bg-[#0f172a]/60 px-2.5 py-1 text-[10px] text-slate-500">
                                      Modo Planejamento
                                    </span>
                                  </div>
                                ) : row.type === 'fp' ? (
                                  <div className="flex justify-center">
                                    <span className="inline-flex items-center rounded border border-[#334155] bg-[#0f172a]/60 px-2.5 py-1 text-[11px] text-slate-400">
                                      Sem desgaste
                                    </span>
                                  </div>
                                ) : !row.tiresEndEnabled ? (
                                  <div className="flex justify-center">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (row.type === 'race') {
                                          updateRaceStint(row.stintNum, 'tiresEndEnabled', true);
                                        } else {
                                          updatePreSession(row.type, 'tiresEndEnabled', true);
                                        }
                                      }}
                                      className="inline-flex items-center gap-1 rounded-md border border-dashed border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-300 transition-colors hover:border-amber-400 hover:bg-amber-500/20 cursor-pointer"
                                    >
                                      + Registrar Pneus
                                    </button>
                                  </div>
                                ) : (
                                  <div className="mx-auto flex flex-col items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (row.type === 'race') {
                                          updateRaceStint(row.stintNum, 'tiresEndEnabled', false);
                                        } else {
                                          updatePreSession(row.type, 'tiresEndEnabled', false);
                                        }
                                      }}
                                      className="inline-flex items-center gap-1 rounded border border-slate-600/70 bg-slate-800/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-300 transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-300 cursor-pointer"
                                    >
                                      × Desregistrar
                                    </button>
                                    <div className="grid w-[132px] grid-cols-2 gap-1.5">
                                      {TIRE_CORNERS.map(({ key }) => (
                                        <TireBadgeEditor
                                          key={`end-${key}`}
                                          corner={key}
                                          tireId={row.endTireMeta?.[key]?.tireId}
                                          value={row.tiresEnd[key]}
                                          onChange={(val) => {
                                            if (row.type === 'race') {
                                              updateRaceStintTire(row.stintNum, 'tiresEnd', key, val);
                                            } else {
                                              updatePreSessionTire(row.type, 'tiresEnd', key, val);
                                            }
                                          }}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </td>
                              {stintMode === 'race' && (
                                <td className="w-4 p-0">
                                  <div className="flex h-full min-h-[44px] items-stretch">
                                    <CheckeredStripButton
                                      done={isStintDone}
                                      onToggle={() => toggleCompletedItem(row.id)}
                                    />
                                  </div>
                                </td>
                              )}
                            </tr>

                            {row.type === 'race' && !row.isLastStint && (
                              <tr
                                className={`border-y ${
                                  stintMode === 'planning'
                                    ? 'bg-indigo-500/5 border-indigo-500/25'
                                    : 'bg-amber-500/5 border-amber-500/20'
                                } ${isPitDone ? 'opacity-70' : ''}`}
                              >
                                <td colSpan={4} className="px-3 py-1">
                                  <div className="flex items-center gap-2 whitespace-nowrap text-[11px]">
                                    <Wrench className={`h-3 w-3 shrink-0 ${stintMode === 'planning' ? 'text-indigo-300' : 'text-[#eab308]'}`} />
                                    <span className={`font-bold uppercase tracking-wider ${stintMode === 'planning' ? 'text-indigo-300' : 'text-[#eab308]'}`}>
                                      Pit {String(row.stintNum).padStart(2, '0')}→{String((row.stintNum || 0) + 1).padStart(2, '0')}
                                    </span>
                                    <span className="rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.2 font-mono font-bold text-emerald-300">
                                      {row.mfdTargetLabel}
                                    </span>
                                    <span className="font-mono text-slate-300">
                                      • Pit: <strong className="text-amber-300">{row.pitStationarySec.toFixed(1)}s</strong>{' '}
                                      <span className="text-slate-400">(+{row.pitlaneLossSec}s)</span>
                                    </span>
                                  </div>
                                </td>
                                <td colSpan={2} className="px-3 py-1 text-center">
                                  <select
                                    value={row.pitScenario}
                                    onChange={(e) =>
                                      updateRaceStint(row.stintNum, 'pitScenario', e.target.value)
                                    }
                                    className="mx-auto rounded-md border border-amber-500/35 bg-[#0f172a] px-2 py-0.5 text-[11px] font-medium text-slate-100 focus:border-[#eab308] focus:outline-none cursor-pointer"
                                  >
                                    {PIT_SCENARIOS.map((sc) => (
                                      <option key={sc.id} value={sc.id}>
                                        {sc.label} (
                                        {calculatePitStopDetails({
                                          scenarioId: sc.id,
                                          params,
                                          carClass: params.carClass || 'LMGT3',
                                          nextStintLaps: row.nextStintLaps,
                                          remainingFuelL: row.remainingFuelL,
                                          remainingEnergyPct: row.remainingEnergyPct,
                                          hasDriverSwap: row.hasDriverSwap,
                                        }).stationarySec.toFixed(1)}
                                        s)
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                {stintMode === 'race' && (
                                  <td className="w-4 p-0">
                                    <div className="flex h-full min-h-[32px] items-stretch">
                                      <CheckeredStripButton
                                        done={isPitDone}
                                        onToggle={() => toggleCompletedItem(`pit_${row.stintNum}`)}
                                      />
                                    </div>
                                  </td>
                                )}
                              </tr>
                            )}
                          </>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {stintMode === 'planning' ? (
              <div className="hidden md:flex justify-between gap-3 border-t border-[#334155] bg-slate-800/60 px-4 py-3">
                <button
                  type="button"
                  onClick={handleClearPlanning}
                  className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-300 transition-colors hover:bg-red-500/20 cursor-pointer"
                >
                  Limpar Planejamento
                </button>
                <button
                  type="button"
                  onClick={handleExportPlanningToRace}
                  className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#22c55e] transition-colors hover:bg-emerald-500/25 cursor-pointer"
                >
                  Exportar Planejamento para Corrida
                </button>
              </div>
            ) : (
              <div className="hidden md:flex justify-end border-t border-[#334155] bg-slate-800/60 px-4 py-3">
                <button
                  type="button"
                  onClick={handleClearRace}
                  className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-300 transition-colors hover:bg-red-500/20 cursor-pointer"
                >
                  Limpar Dados da Corrida
                </button>
              </div>
            )}

            {/* MOBILE CARDS (< md) */}
            <div className="space-y-2.5 p-2.5 bg-[#0f172a]/70 md:hidden">
              {enrichedSchedule.map((row) => {
                const isCollapsed = expandedStintId !== row.id;
                const nextStintLabel = `Stint ${String((row.stintNum || 0) + 1).padStart(2, '0')}`;
                const isStintDone = stintMode === 'race' && Boolean(completedItems[row.id]);
                const isPitDone = stintMode === 'race' && Boolean(completedItems[`pit_${row.stintNum}`]);
                const cardColorClass =
                  stintMode === 'planning'
                    ? row.type === 'fp'
                      ? 'border-sky-500/35 border-l-sky-400 bg-gradient-to-br from-sky-950/55 via-[#1e293b] to-[#172033]'
                      : row.type === 'qualy'
                      ? 'border-indigo-500/45 border-l-indigo-400 bg-gradient-to-br from-indigo-950/55 via-[#1e293b] to-[#172033]'
                      : 'border-cyan-500/40 border-l-cyan-400 bg-gradient-to-br from-cyan-950/45 via-[#1e293b] to-[#172033]'
                    : row.type === 'fp'
                    ? 'border-sky-500/35 border-l-sky-400 bg-gradient-to-br from-sky-950/60 via-[#1e293b] to-[#172033]'
                    : row.type === 'qualy'
                    ? 'border-amber-500/45 border-l-[#eab308] bg-gradient-to-br from-amber-950/50 via-[#1e293b] to-[#172033]'
                    : 'border-emerald-500/45 border-l-[#22c55e] bg-gradient-to-br from-emerald-950/50 via-[#1e293b] to-[#172033]';
                const labelBadgeClass =
                  stintMode === 'planning'
                    ? row.type === 'fp'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                      : row.type === 'qualy'
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                      : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : row.type === 'fp'
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                    : row.type === 'qualy'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
                return (
                  <React.Fragment key={row.id}>
                    {row.type === 'fp' ? (
                      <div className={`flex items-center justify-between gap-2 rounded-lg border border-l-4 px-3.5 py-1.5 text-[10px] ${cardColorClass}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="inline-block w-6 shrink-0" aria-hidden="true" />
                          <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-sky-400" />
                          <span className={`rounded border px-2 py-0.5 text-xs font-extrabold tracking-wide whitespace-nowrap ${labelBadgeClass}`}>
                            {row.label}
                          </span>
                        </div>
                        <span className="font-mono tabular-nums text-slate-300 shrink-0">
                          {formatMinutesToHHMM(row.startMin)}-{formatMinutesToHHMM(row.endMin)} • {Math.round(row.durationMin)}m ({row.laps}v)
                        </span>
                      </div>
                    ) : (
                    <div
                      onClick={(e) => {
                        if (e.target.closest('input, select, button')) return;
                        toggleStintCollapse(row.id);
                      }}
                      className={`flex items-stretch overflow-hidden rounded-xl border border-l-4 shadow-md transition-all cursor-pointer ${cardColorClass} ${isStintDone ? 'opacity-70' : ''}`}
                    >
                    <div className="flex-1 min-w-0 p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {row.type !== 'fp' && (
                            <button
                              type="button"
                              onClick={() => toggleStintCollapse(row.id)}
                              title={isCollapsed ? 'Expandir stint' : 'Minimizar stint'}
                              className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#334155] bg-[#0f172a] text-slate-400 hover:text-[#eab308]"
                            >
                              {isCollapsed ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronUp className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                          <span
                            className={`inline-flex h-2.5 w-2.5 rounded-full ${row.type === 'fp'
                              ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.7)]'
                              : row.type === 'qualy'
                                ? 'bg-[#eab308] shadow-[0_0_8px_rgba(234,179,8,0.7)]'
                                : 'bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.7)]'
                              }`}
                          />
                          <div>
                            <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-extrabold tracking-wide ${labelBadgeClass}`}>{row.label}</span>
                            {isCollapsed && row.type !== 'fp' && (
                              <div className="text-[11px] font-semibold text-amber-300">
                                {row.driver}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right font-mono tabular-nums">
                          <div className="text-xs font-bold text-slate-100">
                            {formatMinutesToHHMM(row.startMin)} - {formatMinutesToHHMM(row.endMin)}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {row.durationMin.toFixed(1)} min • {row.laps} voltas
                          </div>
                        </div>
                      </div>

                      {!isCollapsed && row.type !== 'fp' && (
                        <>
                          <div className="flex items-center gap-3">
                            <DriverAvatar90s driver={row.driver} size={52} />
                            <div className="flex-1 min-w-0">
                              <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">
                                Piloto
                              </label>
                              <select
                                value={row.driver}
                                onChange={(e) => {
                                  if (row.type === 'race') {
                                    updateRaceStint(row.stintNum, 'driver', e.target.value);
                                  } else {
                                    updatePreSession(row.type, 'driver', e.target.value);
                                  }
                                }}
                                className="w-full rounded-md border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-xs text-slate-100 focus:border-[#eab308] focus:outline-none"
                              >
                                {DRIVERS.map((d) => {
                                  const allowed = canAssignDriver(row.id, d);
                                  return (
                                    <option key={d} value={d} disabled={!allowed}>
                                      {d}{!allowed ? ' (limite 6)' : ''}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          </div>

                            <div className="space-y-3">
                              <div>
                                <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase text-slate-400">
                                  <span>Pneus Início (Toque para alternar)</span>
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                  {TIRE_CORNERS.map(({ key }) => {
                                    const tireMeta = row.startTireMeta?.[key];
                                    const setStartVal = (val) => {
                                      if (row.type === 'race') {
                                        updateRaceStintTire(row.stintNum, 'tiresStart', key, val);
                                      } else {
                                        updatePreSessionTire(row.type, 'tiresStart', key, val);
                                      }
                                    };
                                    return (
                                      <StartTireToggleButton
                                        key={`m-start-${key}`}
                                        corner={key}
                                        tireMeta={tireMeta}
                                        stintMode={stintMode}
                                        onToggle={() => setTirePitModalRowId(row.id)}
                                      />
                                    );
                                  })}
                                </div>
                              </div>

                              {stintMode === 'race' && (
                              <div>
                                <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase text-slate-400">
                                  <span>Pneus Fim — Borracha Restante</span>
                                  {row.tiresEndEnabled && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (row.type === 'race') {
                                          updateRaceStint(row.stintNum, 'tiresEndEnabled', false);
                                        } else {
                                          updatePreSession(row.type, 'tiresEndEnabled', false);
                                        }
                                      }}
                                      className="inline-flex items-center gap-1 rounded border border-slate-600/70 bg-slate-800/80 px-2 py-0.5 text-[10px] font-semibold text-slate-300 transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-300"
                                    >
                                      × Desregistrar
                                    </button>
                                  )}
                                </div>
                                {!row.tiresEndEnabled ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (row.type === 'race') {
                                        updateRaceStint(row.stintNum, 'tiresEndEnabled', true);
                                      } else {
                                        updatePreSession(row.type, 'tiresEndEnabled', true);
                                      }
                                    }}
                                    className="w-full rounded-md border border-dashed border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 transition-colors hover:border-amber-400 hover:bg-amber-500/20"
                                  >
                                    + Registrar Desgaste de Fim de Stint
                                  </button>
                                ) : (
                                  <div className="grid grid-cols-4 gap-2">
                                    {TIRE_CORNERS.map(({ key }) => (
                                      <TireBadgeEditor
                                        key={`m-end-${key}`}
                                        corner={key}
                                        tireId={row.endTireMeta?.[key]?.tireId}
                                        value={row.tiresEnd[key]}
                                        onChange={(val) => {
                                          if (row.type === 'race') {
                                            updateRaceStintTire(row.stintNum, 'tiresEnd', key, val);
                                          } else {
                                            updatePreSessionTire(row.type, 'tiresEnd', key, val);
                                          }
                                        }}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                              )}
                            </div>
                        </>
                      )}
                    </div>
                    {stintMode === 'race' && (
                      <CheckeredStripButton
                        done={isStintDone}
                        onToggle={() => toggleCompletedItem(row.id)}
                        roundedClass="rounded-r-xl"
                      />
                    )}
                    </div>
                    )}

                    {row.type === 'race' && !row.isLastStint && (
                      <div
                        className={`flex items-stretch overflow-hidden rounded-lg border transition-all ${
                          stintMode === 'planning'
                            ? 'border-indigo-500/40 bg-indigo-500/10'
                            : 'border-amber-500/35 bg-amber-500/10'
                        } ${isPitDone ? 'opacity-70' : ''}`}
                      >
                        <div className="flex flex-1 min-w-0 items-center justify-between gap-1.5 px-2 py-1">
                        <div className="flex items-center gap-1.5 min-w-0 text-[10px] overflow-hidden">
                          <Wrench className={`h-3 w-3 shrink-0 ${stintMode === 'planning' ? 'text-indigo-300' : 'text-[#eab308]'}`} />
                          <span className={`font-bold whitespace-nowrap ${stintMode === 'planning' ? 'text-indigo-300' : 'text-[#eab308]'}`}>
                            P{String(row.stintNum).padStart(2, '0')}→{String((row.stintNum || 0) + 1).padStart(2, '0')}
                          </span>
                          <span className="font-mono font-bold text-emerald-300 truncate">
                            {row.mfdTargetLabel}
                          </span>
                          <span className="font-mono text-amber-300 whitespace-nowrap">
                            • {row.pitStationarySec.toFixed(1)}s
                          </span>
                        </div>
                        <select
                          value={row.pitScenario}
                          onChange={(e) =>
                            updateRaceStint(row.stintNum, 'pitScenario', e.target.value)
                          }
                          className={`shrink-0 max-w-[128px] rounded border bg-[#0f172a] px-1.5 py-0.5 text-[10px] text-slate-100 focus:outline-none ${
                            stintMode === 'planning'
                              ? 'border-indigo-500/40 focus:border-indigo-400'
                              : 'border-amber-500/35 focus:border-[#eab308]'
                          }`}
                        >
                          {PIT_SCENARIOS.map((sc) => (
                            <option key={sc.id} value={sc.id}>
                              {sc.label} (
                              {calculatePitStopDetails({
                                scenarioId: sc.id,
                                params,
                                carClass: params.carClass || 'LMGT3',
                                nextStintLaps: row.nextStintLaps,
                                remainingFuelL: row.remainingFuelL,
                                remainingEnergyPct: row.remainingEnergyPct,
                                hasDriverSwap: row.hasDriverSwap,
                              }).stationarySec.toFixed(1)}
                              s)
                            </option>
                          ))}
                        </select>
                        </div>
                        {stintMode === 'race' && (
                          <CheckeredStripButton
                            done={isPitDone}
                            onToggle={() => toggleCompletedItem(`pit_${row.stintNum}`)}
                            roundedClass="rounded-r-lg"
                          />
                        )}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* BOTTOM PANEL: TIRE MANAGER (BEST TO REUSE) */}
          <div
            className={`rounded-xl border border-[#334155] bg-[#1e293b] p-4 transition-opacity ${
              stintMode === 'planning' ? 'opacity-25 pointer-events-none select-none' : ''
            }`}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Disc className="h-4 w-4 text-[#22c55e]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Gerenciador de Pneus — Melhores para Reaproveitar
                </h2>
              </div>
              <span className="text-[11px] text-slate-400">
                Análise automática por canto comparando as 2 melhores opções
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {TIRE_CORNERS.map(({ key, label }) => {
                const rec = tireRecommendations[key];
                const best = rec?.best;
                const second = rec?.secondBest;

                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setSelectedTireCornerModal(key)}
                    title={`Ver todos os pneus usados em ${key} (${label})`}
                    className="w-full text-left rounded-lg border border-[#334155] bg-[#0f172a]/90 p-3.5 flex flex-col justify-between cursor-pointer transition-colors hover:border-emerald-500/50 hover:bg-[#0f172a] active:scale-[0.99]"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-200">
                          {key} <span className="font-normal text-slate-400">({label})</span>
                        </span>
                        <span className="rounded bg-emerald-500/15 border border-emerald-500/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#22c55e]">
                          SUGERIDO
                        </span>
                      </div>

                      {best ? (
                        <>
                          <div className="mt-2.5 flex items-baseline justify-between">
                            <span
                              className={`text-2xl font-extrabold font-mono tabular-nums ${getTireTextColor(
                                best.pct
                              )}`}
                            >
                              {best.pct}%
                            </span>
                            <span className="text-xs font-medium text-slate-300">
                              <span className="font-mono font-bold text-amber-300 mr-1">
                                {best.tireId}
                              </span>
                              ({best.sourceLabel})
                            </span>
                          </div>

                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                            <div
                              className={`h-full transition-all ${getTireBarColor(best.pct)}`}
                              style={{ width: `${best.pct}%` }}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>Sem dados</span>
                        </div>
                      )}
                    </div>

                    {second && (
                      <div className="mt-3 border-t border-[#334155]/70 pt-2 flex items-center justify-between text-[11px] text-slate-400">
                        <span>2ª melhor opção:</span>
                        <span className="font-mono tabular-nums text-slate-300">
                          {second.pct}% ({second.tireId} • {second.sourceLabel})
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

        </section>
      </main>

      {/* TIRE CORNER RANKING MODAL */}
      {selectedTireCornerModal && (() => {
        const rec = tireRecommendations[selectedTireCornerModal];
        const items = rec?.all || [];
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={() => setSelectedTireCornerModal(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-[#334155] bg-[#0f172a] shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[#334155] bg-[#1e293b] px-4 py-3">
                <div className="flex items-center gap-2">
                  <Disc className="h-4 w-4 text-[#22c55e]" />
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Pneus Usados — {rec?.key} ({rec?.label})
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Ordenados do melhor para o pior desgaste
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTireCornerModal(null)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#334155] bg-[#0f172a] text-slate-400 hover:text-white cursor-pointer"
                  title="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[65vh] overflow-y-auto p-4 space-y-2.5">
                {items.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-400">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <span>Nenhum pneu usado registrado para este lado.</span>
                  </div>
                ) : (
                  items.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-3 ${
                        idx === 0
                          ? 'border-emerald-500/45 bg-emerald-950/25'
                          : 'border-[#334155] bg-[#1e293b]/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-5 min-w-[24px] items-center justify-center rounded bg-[#0f172a] border border-[#334155] px-1.5 font-mono text-[11px] font-bold text-slate-300">
                            {idx + 1}º
                          </span>
                          <span className="font-mono text-xs font-bold text-amber-300">
                            {item.tireId}
                          </span>
                          <span className="text-xs text-slate-300">
                            ({item.sourceLabel})
                          </span>
                          {idx === 0 && (
                            <span className="rounded bg-emerald-500/15 border border-emerald-500/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#22c55e]">
                              MELHOR
                            </span>
                          )}
                        </div>
                        <span
                          className={`font-mono text-base font-extrabold tabular-nums ${getTireTextColor(
                            item.pct
                          )}`}
                        >
                          {item.pct}%
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={`h-full transition-all ${getTireBarColor(item.pct)}`}
                          style={{ width: `${item.pct}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* CIRCUIT PICKER MODAL */}
      {circuitModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setCircuitModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-[#334155] bg-[#0f172a] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#334155] bg-[#1e293b] px-4 py-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#eab308]" />
                <div>
                  <h3 className="text-sm font-bold text-white">Selecionar Circuito</h3>
                  <p className="text-[11px] text-slate-400">
                    Escolha a pista pelo país e traçado
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCircuitModalOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#334155] bg-[#0f172a] text-slate-400 hover:text-white cursor-pointer"
                title="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {LMU_CIRCUITS.map((circuit) => {
                const isSelected = circuit.id === selectedCircuit.id;
                return (
                  <button
                    type="button"
                    key={circuit.id}
                    onClick={() => {
                      handleParamChange('circuitId', circuit.id);
                      setCircuitModalOpen(false);
                    }}
                    className={`flex flex-col justify-between rounded-xl border p-3 text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/15 shadow-[0_0_12px_rgba(234,179,8,0.2)]'
                        : 'border-[#334155] bg-[#1e293b]/80 hover:border-amber-500/50 hover:bg-[#1e293b]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-lg leading-none">{circuit.flag}</span>
                      {isSelected && (
                        <span className="rounded bg-amber-500/20 border border-amber-500/50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-300">
                          Atual
                        </span>
                      )}
                    </div>
                    <CircuitTrackSvg
                      svgPath={circuit.svgPath}
                      spin3d={isSelected}
                      className={`my-2 h-12 w-full ${
                        isSelected ? 'text-[#eab308]' : 'text-slate-300'
                      }`}
                    />
                    <div>
                      <div className="text-xs font-bold text-white leading-tight">
                        {circuit.shortName}
                      </div>
                      <div className="text-[10px] text-slate-400">{circuit.country}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* CALENDAR EVENT DRIVER SIGNUP MODAL */}
      {calendarEventModal && (() => {
        const signups = eventSignups[calendarEventModal.id] || [];
        const availableDrivers = DRIVERS.filter((d) => d !== 'ND');
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
            onClick={() => setCalendarEventModal(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-[#334155] bg-[#0f172a] shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[#334155] bg-[#1e293b] px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Calendar className="h-4 w-4 shrink-0 text-[#eab308]" />
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-white">
                      {calendarEventModal.track}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {calendarEventModal.dates} • {calendarEventModal.classes}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCalendarEventModal(null)}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#334155] bg-[#0f172a] text-slate-400 hover:text-white cursor-pointer"
                  title="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[72vh] overflow-y-auto p-4 space-y-4">
                <form onSubmit={handleSaveEventSignup} className="space-y-3 rounded-xl border border-[#334155] bg-[#1e293b]/70 p-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">
                      Pré-cadastro de Piloto
                    </label>
                    <select
                      value={signupDriverDraft}
                      onChange={(e) => {
                        const nextDrv = e.target.value;
                        setSignupDriverDraft(nextDrv);
                        const found = signups.find((s) => s.driver === nextDrv);
                        if (found?.classes?.length) setSignupClassesDraft(found.classes);
                      }}
                      className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-xs font-semibold text-white focus:border-[#eab308] focus:outline-none"
                    >
                      {availableDrivers.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[10px] font-semibold uppercase text-slate-400">
                      Categorias viáveis (marque uma ou mais)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {LMU_CAR_CLASSES.map((cls) => {
                        const checked = signupClassesDraft.includes(cls.id);
                        return (
                          <button
                            type="button"
                            key={cls.id}
                            onClick={() => toggleSignupClass(cls.id)}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                              checked
                                ? 'border-amber-500 bg-amber-500/20 text-amber-200'
                                : 'border-[#334155] bg-[#0f172a] text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <span
                              className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded border text-[9px] ${
                                checked
                                  ? 'border-amber-400 bg-amber-400 text-slate-950'
                                  : 'border-slate-500'
                              }`}
                            >
                              {checked ? '✓' : ''}
                            </span>
                            {cls.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-lg bg-[#eab308] px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer"
                  >
                    Confirmar Pré-cadastro
                  </button>
                </form>

                <div>
                  <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    <span>Pilotos Pré-cadastrados ({signups.length})</span>
                  </div>
                  {signups.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[#334155] py-4 text-center text-xs text-slate-500">
                      Nenhum piloto pré-cadastrado nesta etapa ainda.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {signups.map((item) => (
                        <div
                          key={item.driver}
                          className="flex items-center justify-between gap-2 rounded-xl border border-[#334155] bg-[#1e293b]/80 px-3 py-2"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <DriverAvatar90s driver={item.driver} size={32} />
                            <div className="min-w-0">
                              <div className="truncate text-xs font-bold text-white">
                                {item.driver}
                              </div>
                              <div className="mt-0.5 flex flex-wrap gap-1">
                                {(item.classes || []).map((cid) => {
                                  const meta = LMU_CAR_CLASSES.find((c) => c.id === cid);
                                  return (
                                    <span
                                      key={cid}
                                      className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                        meta?.badgeClass || 'border-slate-600 text-slate-300'
                                      }`}
                                    >
                                      {meta?.label || cid}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveEventSignup(calendarEventModal.id, item.driver)}
                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[#334155] bg-[#0f172a] text-slate-400 hover:text-red-400 cursor-pointer"
                            title="Remover pré-cadastro"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PITBOX GT3 TIRE PICKER MODAL */}
      {tirePitModalRowId && (() => {
        const modalRow = enrichedSchedule.find((r) => r.id === tirePitModalRowId);
        if (!modalRow) return null;

        const setCornerVal = (corner, val) => {
          if (modalRow.type === 'race') {
            updateRaceStintTire(modalRow.stintNum, 'tiresStart', corner, val);
          } else {
            updatePreSessionTire(modalRow.type, 'tiresStart', corner, val);
          }
        };

        const setAllCorners = (val) => {
          const nextMap = { FL: val, FR: val, RL: val, RR: val };
          if (modalRow.type === 'race') {
            updateRaceStint(modalRow.stintNum, 'tiresStart', nextMap);
          } else {
            updatePreSession(modalRow.type, 'tiresStart', nextMap);
          }
        };

        const renderCornerControls = (cornerKey, alignRight) => {
          const meta = modalRow.startTireMeta?.[cornerKey];
          const mode = meta?.mode || 'new';
          const isKeep = mode === 'keep';
          const isWet = mode === 'wet' || (isKeep && Boolean(meta?.isWet));
          const canKeep = stintMode === 'planning' || Boolean(meta?.canKeep);

          const tirePillColor =
            mode === 'wet'
              ? 'border-blue-400 bg-blue-500/25 text-sky-200 shadow-[0_0_12px_rgba(56,189,248,0.3)]'
              : mode === 'new'
              ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(34,197,94,0.25)]'
              : mode === 'keep'
              ? isWet
                ? 'border-blue-400/35 bg-blue-500/10 text-sky-300/80 opacity-65'
                : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300/80 opacity-65'
              : 'border-amber-400 bg-amber-500/20 text-amber-300 shadow-[0_0_12px_rgba(234,179,8,0.25)]';

          const options = [
            { id: 'new', val: 100, label: 'Seco', icon: 'sun' },
            ...(canKeep ? [{ id: 'keep', val: 'keep', label: 'Manter', icon: isWet ? 'drop' : 'sun' }] : []),
            { id: 'used', val: stintMode === 'planning' ? 'used' : 'ND', label: 'Usado', icon: 'sun' },
            { id: 'wet', val: 'wet', label: 'Chuva', icon: 'drop' },
          ];

          return (
            <div className={`flex flex-col gap-1.5 ${alignRight ? 'items-end' : 'items-start'}`}>
              {/* Animated Tire Visual (slides inward when MANTER / installed, outward when in pitbox) */}
              <div className="flex items-center gap-1.5">
                <div
                  className={`flex h-12 w-10 flex-col items-center justify-center rounded-md border-2 font-mono text-[11px] font-extrabold transition-all duration-300 ease-out ${tirePillColor} ${
                    isKeep
                      ? alignRight
                        ? 'translate-x-4 scale-90'
                        : '-translate-x-4 scale-90'
                      : 'translate-x-0 scale-100'
                  }`}
                  title={isKeep ? `${cornerKey}: Instalado no carro (Manter)` : `${cornerKey}: No box para troca`}
                >
                  <span className="leading-none opacity-90">{cornerKey}</span>
                  <span className="mt-1">
                    {isWet ? (
                      <Droplets className="h-3.5 w-3.5 text-sky-300" />
                    ) : (
                      <Sun className="h-3.5 w-3.5 text-amber-300" />
                    )}
                  </span>
                </div>
              </div>

              {/* 4 quick choice buttons */}
              <div className="grid grid-cols-2 gap-1.5">
                {options.map((opt) => {
                  const active = mode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCornerVal(cornerKey, opt.val)}
                      className={`inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md border px-2 py-1.5 text-[11px] sm:text-xs font-bold transition-colors cursor-pointer ${
                        active
                          ? opt.id === 'wet'
                            ? 'border-blue-400 bg-blue-500/30 text-sky-200'
                            : opt.id === 'new'
                            ? 'border-emerald-400 bg-emerald-500/25 text-emerald-200'
                            : opt.id === 'keep'
                            ? 'border-slate-400 bg-slate-600/40 text-white'
                            : 'border-amber-400 bg-amber-500/25 text-amber-200'
                          : 'border-[#334155] bg-[#0f172a] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {opt.icon === 'drop' ? (
                        <Droplets className="h-3.5 w-3.5 shrink-0 text-sky-300" />
                      ) : (
                        <Sun className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                      )}
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        };

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-sm"
            onClick={() => setTirePitModalRowId(null)}
          >
            <div
              className="w-full max-w-lg rounded-2xl border border-[#334155] bg-[#0f172a] shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[#334155] bg-[#1e293b] px-4 py-3">
                <div className="flex items-center gap-2">
                  <Disc className="h-4 w-4 text-[#22c55e]" />
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Box — {modalRow.label}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Selecione os pneus por canto (Manter = instalado no carro)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTirePitModalRowId(null)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#334155] bg-[#0f172a] text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-3 sm:p-4 space-y-4">
                {/* Quick All-4 Presets */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAllCorners(100)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 cursor-pointer"
                  >
                    <Sun className="h-3.5 w-3.5 text-amber-300" />
                    4x Seco
                  </button>
                  {(stintMode === 'planning' ||
                    TIRE_CORNERS.every(({ key }) => modalRow.startTireMeta?.[key]?.canKeep)) && (
                    <button
                      type="button"
                      onClick={() => setAllCorners('keep')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#334155] bg-[#1e293b] px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-slate-400 cursor-pointer"
                    >
                      4x Manter
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setAllCorners('wet')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-400/40 bg-blue-500/15 px-3 py-1.5 text-xs font-bold text-sky-300 hover:bg-blue-500/25 cursor-pointer"
                  >
                    <Droplets className="h-3.5 w-3.5 text-sky-300" />
                    4x Chuva
                  </button>
                </div>

                {/* Pitbox Top-Down GT3 Car Diagram */}
                <div className="relative rounded-xl border border-dashed border-amber-500/35 bg-[#111827] px-2 sm:px-3 py-4">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 sm:gap-2">
                    {/* Left Side (FL & RL) */}
                    <div className="flex flex-col justify-between gap-8">
                      {renderCornerControls('FL', true)}
                      {renderCornerControls('RL', true)}
                    </div>

                    {/* Top-Down Porsche 911 GT3 Blueprint SVG */}
                    <div className="flex items-center justify-center px-0.5 sm:px-1">
                      <svg
                        viewBox="0 0 140 260"
                        fill="none"
                        className="h-44 w-20 sm:h-56 sm:w-28 drop-shadow-[0_0_10px_rgba(234,179,8,0.18)]"
                        aria-hidden="true"
                      >
                        {/* Outer Body Silhouette (Porsche 911 GT3 widebody) */}
                        <path
                          d="M42 18 C52 10, 88 10, 98 18 C110 26, 116 38, 116 52 L116 90 C114 102, 112 115, 112 135 C112 152, 118 164, 119 178 C120 198, 117 222, 108 238 C98 248, 42 248, 32 238 C23 222, 20 198, 21 178 C22 164, 28 152, 28 135 C28 115, 26 102, 24 90 L24 52 C24 38, 30 26, 42 18 Z"
                          stroke="#eab308"
                          strokeWidth="1.5"
                          strokeLinejoin="round"
                        />

                        {/* Front Bumper & Hood Seam */}
                        <path
                          d="M32 32 C46 18, 94 18, 108 32"
                          stroke="#eab308"
                          strokeWidth="1"
                          strokeOpacity="0.85"
                        />
                        <path
                          d="M48 22 L34 86 M92 22 L106 86"
                          stroke="#eab308"
                          strokeWidth="1"
                          strokeOpacity="0.8"
                        />
                        {/* Subtle Hood Center Lines */}
                        <path
                          d="M60 22 L57 76 M80 22 L83 76"
                          stroke="#38bdf8"
                          strokeWidth="0.8"
                          strokeOpacity="0.45"
                        />

                        {/* Iconic Oval Porsche Headlights */}
                        <g transform="translate(36 42) rotate(18)">
                          <ellipse cx="0" cy="0" rx="6.5" ry="9.5" stroke="#eab308" strokeWidth="1.3" />
                          <circle cx="0" cy="-1" r="3.8" stroke="#38bdf8" strokeWidth="0.9" strokeOpacity="0.85" />
                        </g>
                        <g transform="translate(104 42) rotate(-18)">
                          <ellipse cx="0" cy="0" rx="6.5" ry="9.5" stroke="#eab308" strokeWidth="1.3" />
                          <circle cx="0" cy="-1" r="3.8" stroke="#38bdf8" strokeWidth="0.9" strokeOpacity="0.85" />
                        </g>

                        {/* Side Mirrors */}
                        <path
                          d="M25 104 L13 107 C10 108, 10 115, 14 116 L26 113 Z"
                          stroke="#eab308"
                          strokeWidth="1.2"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M115 104 L127 107 C130 108, 130 115, 126 116 L114 113 Z"
                          stroke="#eab308"
                          strokeWidth="1.2"
                          strokeLinejoin="round"
                        />

                        {/* Twin Roof Racing Stripes (subtle translucent blue) */}
                        <rect x="61" y="120" width="7" height="58" fill="#38bdf8" fillOpacity="0.16" />
                        <rect x="72" y="120" width="7" height="58" fill="#38bdf8" fillOpacity="0.16" />

                        {/* Windshield Frame & Glass */}
                        <path
                          d="M34 94 C44 74, 96 74, 106 94 L98 122 C82 118, 58 118, 42 122 Z"
                          stroke="#eab308"
                          strokeWidth="1.3"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M39 95 C48 80, 92 80, 101 95 L95 117 C80 114, 60 114, 45 117 Z"
                          stroke="#38bdf8"
                          strokeWidth="1"
                          strokeLinejoin="round"
                        />
                        {/* Windshield Wipers */}
                        <path
                          d="M44 86 L72 79 M72 79 L98 89"
                          stroke="#38bdf8"
                          strokeWidth="0.7"
                          strokeOpacity="0.5"
                        />

                        {/* Cabin Side Windows & Roofline */}
                        <path
                          d="M34 94 C31 118, 30 148, 34 178 L42 178 C43 154, 43 136, 42 122"
                          stroke="#eab308"
                          strokeWidth="1.1"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M106 94 C109 118, 110 148, 106 178 L98 178 C97 154, 97 136, 98 122"
                          stroke="#eab308"
                          strokeWidth="1.1"
                          strokeLinejoin="round"
                        />
                        {/* Rear Haunch Accent Lines */}
                        <path
                          d="M27 154 C30 174, 31 198, 34 218 M113 154 C110 174, 109 198, 106 218"
                          stroke="#38bdf8"
                          strokeWidth="0.8"
                          strokeOpacity="0.4"
                        />

                        {/* Rear Window */}
                        <rect
                          x="45"
                          y="176"
                          width="50"
                          height="36"
                          rx="8"
                          stroke="#eab308"
                          strokeWidth="1.2"
                        />
                        <rect
                          x="49"
                          y="180"
                          width="42"
                          height="28"
                          rx="6"
                          stroke="#38bdf8"
                          strokeWidth="0.9"
                        />

                        {/* Rear Engine Decklid Grille / Louvers */}
                        <path
                          d="M48 218 L92 218 M49 224 L91 224 M50 230 L90 230"
                          stroke="#38bdf8"
                          strokeWidth="0.85"
                          strokeOpacity="0.6"
                        />
                        <path
                          d="M58 216 L58 232 M66 216 L66 232 M74 216 L74 232 M82 216 L82 232"
                          stroke="#38bdf8"
                          strokeWidth="0.7"
                          strokeOpacity="0.45"
                        />

                        {/* GT3 Rear Wing & Endplates */}
                        <path
                          d="M28 228 C44 238, 96 238, 112 228 L112 242 C96 250, 44 250, 28 242 Z"
                          stroke="#38bdf8"
                          strokeWidth="1"
                        />
                        <path
                          d="M28 242 C44 250, 96 250, 112 242"
                          stroke="#eab308"
                          strokeWidth="1.4"
                        />
                        {/* Wing Endplates */}
                        <rect x="25" y="224" width="3.5" height="22" rx="1.5" stroke="#eab308" strokeWidth="1.2" />
                        <rect x="111.5" y="224" width="3.5" height="22" rx="1.5" stroke="#eab308" strokeWidth="1.2" />
                        {/* Swan-Neck Wing Uprights */}
                        <rect x="46" y="224" width="2.5" height="20" rx="1" stroke="#38bdf8" strokeWidth="1" />
                        <rect x="91.5" y="224" width="2.5" height="20" rx="1" stroke="#38bdf8" strokeWidth="1" />
                      </svg>
                    </div>

                    {/* Right Side (FR & RR) */}
                    <div className="flex flex-col justify-between gap-8">
                      {renderCornerControls('FR', false)}
                      {renderCornerControls('RR', false)}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setTirePitModalRowId(null)}
                  className="w-full rounded-xl bg-[#eab308] px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer"
                >
                  Concluído
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CLONE STRATEGY TO ANOTHER CAR MODAL */}
      {cloneModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setCloneModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[#334155] bg-[#0f172a] p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Copiar Estratégia para Outro Carro
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  Origem: <strong className="text-amber-300">{activeCar.label}</strong> ({selectedCar.name})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCloneModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-300">
              Escolha o carro de destino para copiar parâmetros de consumo, modelo e stints (você poderá ajustar os pilotos depois):
            </p>
            <div className="space-y-2">
              {carOrder
                .filter((id) => id !== activeCar.id)
                .map((targetId) => {
                  const targetCar = cars[targetId];
                  if (!targetCar) return null;
                  const preset = CAR_SLOT_PRESETS[targetId] || CAR_SLOT_PRESETS['car-1'];
                  return (
                    <button
                      key={targetId}
                      type="button"
                      onClick={() => handleCloneCarStrategy(targetId)}
                      className="w-full flex items-center justify-between gap-2 rounded-xl border border-[#334155] bg-[#1e293b] px-3 py-2.5 text-left hover:border-amber-500/60 hover:bg-[#1e293b]/80 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${preset.dotClass}`} />
                        <span className="text-xs font-bold text-white">{targetCar.label}</span>
                      </div>
                      <span className="text-[10px] font-semibold text-amber-300">Copiar para cá →</span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* VISÃO GERAL FTR (TODOS OS CARROS) MODAL */}
      {overviewModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6 backdrop-blur-sm"
          onClick={() => setOverviewModalOpen(false)}
        >
          <div
            className="w-full max-w-6xl max-h-[90vh] flex flex-col rounded-2xl border border-[#334155] bg-[#0f172a] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#334155] bg-[#1e293b] px-4 py-3 sm:px-5">
              <div className="flex items-center gap-3">
                <LayoutGrid className="h-5 w-5 shrink-0 text-[#eab308]" />
                <CircuitTrackSvg
                  svgPath={selectedCircuit.svgPath}
                  spin3d={true}
                  className="hidden sm:block h-8 w-14 shrink-0 text-[#38bdf8]"
                />
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-white">
                    Visão Geral FTR — Todos os Carros ({allCarsOverview.carSummaries.length})
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {selectedCircuit.flag} {selectedCircuit.name} • {eventConfig.championship} • Duração {eventConfig.raceDurationStr} • Modo{' '}
                    <span className="font-semibold text-slate-200">
                      {stintMode === 'race' ? 'Corrida' : 'Planejamento'}
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOverviewModalOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#334155] bg-[#0f172a] text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
              {/* Alertas de Conflito de Piloto */}
              {allCarsOverview.driverConflicts.length > 0 && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-300">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Conflito de Piloto em Múltiplos Carros</span>
                  </div>
                  {allCarsOverview.driverConflicts.map((c, idx) => (
                    <p key={`drv-conf-${idx}`} className="text-[11px] text-red-200">
                      <strong>{c.driver}</strong> escalado simultaneamente em{' '}
                      <strong>{c.carA}</strong> ({c.stintA}) e <strong>{c.carB}</strong> ({c.stintB}) entre{' '}
                      <span className="font-mono">
                        {formatMinutesToHHMM(c.startMin)}–{formatMinutesToHHMM(c.endMin)}
                      </span>
                      .
                    </p>
                  ))}
                </div>
              )}

              {/* Resumo Lado a Lado dos Carros */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {allCarsOverview.carSummaries.map((s) => (
                  <div
                    key={s.id}
                    className={`rounded-xl border border-[#334155] border-l-4 ${s.preset.accentBorder} bg-[#1e293b]/80 p-3.5 space-y-2`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.preset.dotClass}`} />
                        <span className="text-xs font-extrabold text-white truncate">
                          {s.car.label}
                        </span>
                      </div>
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase ${s.classMeta.badgeClass}`}
                      >
                        {s.classMeta.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-300">
                      <ManufacturerLogo brand={s.model.brand} size={20} />
                      <span className="truncate font-medium">{s.model.name}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 pt-1 text-center font-mono text-[11px]">
                      <div className="rounded bg-[#0f172a]/80 p-1.5">
                        <div className="text-[9px] font-sans uppercase text-slate-400">Stints</div>
                        <div className="font-bold text-white">{s.raceStints.length}</div>
                      </div>
                      <div className="rounded bg-[#0f172a]/80 p-1.5">
                        <div className="text-[9px] font-sans uppercase text-slate-400">Voltas</div>
                        <div className="font-bold text-[#22c55e]">{s.totalLaps}</div>
                      </div>
                      <div className="rounded bg-[#0f172a]/80 p-1.5">
                        <div className="text-[9px] font-sans uppercase text-slate-400">Pits</div>
                        <div className="font-bold text-amber-300">{s.pitCount}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCarId(s.id);
                        setOverviewModalOpen(false);
                      }}
                      className="w-full rounded-lg border border-[#334155] bg-[#0f172a] py-1.5 text-[11px] font-bold text-slate-200 hover:border-amber-500/60 hover:text-amber-300 transition-colors cursor-pointer"
                    >
                      Abrir Estratégia deste Carro
                    </button>
                  </div>
                ))}
              </div>

              {/* Comparativo de Pilotos por Stint (Lado a Lado) */}
              <div className="rounded-xl border border-[#334155] bg-[#1e293b]/60 overflow-hidden">
                <div className="border-b border-[#334155] bg-[#1e293b] px-4 py-2.5 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Escala de Pilotos & Horários (Lado a Lado)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Horário de início → fim e duração do stint
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#334155] bg-[#0f172a]/60 text-[10px] uppercase text-slate-400">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Stint</th>
                        {allCarsOverview.carSummaries.map((s) => (
                          <th key={`th-${s.id}`} className="px-3 py-2 font-bold text-slate-200">
                            <span className="inline-flex items-center gap-1.5">
                              <span className={`h-2 w-2 rounded-full ${s.preset.dotClass}`} />
                              <span>{s.car.label}</span>
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#334155]/60">
                      {Array.from({
                        length: Math.max(
                          0,
                          ...allCarsOverview.carSummaries.map((s) => s.raceStints.length)
                        ),
                      }).map((_, idx) => (
                        <tr key={`ov-stint-${idx}`} className="hover:bg-[#0f172a]/40">
                          <td className="px-3 py-2 font-mono font-bold text-slate-300 whitespace-nowrap">
                            Stint {String(idx + 1).padStart(2, '0')}
                          </td>
                          {allCarsOverview.carSummaries.map((s) => {
                            const row = s.raceStints[idx];
                            if (!row) {
                              return (
                                <td key={`cell-${s.id}-${idx}`} className="px-3 py-2 text-slate-600">
                                  —
                                </td>
                              );
                            }
                            return (
                              <td key={`cell-${s.id}-${idx}`} className="px-3 py-2">
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-white">{row.driver}</span>
                                    <span className="font-mono text-[10px] text-slate-400">
                                      ({formatMinutesToHHMM(row.startMin)}–{formatMinutesToHHMM(row.endMin)})
                                    </span>
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-400">
                                    {row.laps}v •{' '}
                                    {row.isLastStint ? (
                                      <span className="text-[#22c55e] font-semibold">🏁 Bandeira</span>
                                    ) : (
                                      <span className="text-amber-300">
                                        Box {formatMinutesToHHMM(row.endMin)} • {row.mfdTargetLabel} • Pit: {row.pitStationarySec.toFixed(1)}s
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Cronograma Unificado de Pitstops (Discord / Coordenação) */}
              <div className="rounded-xl border border-[#334155] bg-[#1e293b]/60 overflow-hidden">
                <div className="border-b border-[#334155] bg-[#1e293b] px-4 py-2.5 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Ordem Cronológica de Pitstops (Coordenação Discord)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Alerta quando 2 carros param em janela ≤ 2,5 min
                  </span>
                </div>
                {allCarsOverview.pitEvents.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    Nenhum pitstop programado nesta duração de corrida.
                  </div>
                ) : (
                  <div className="divide-y divide-[#334155]/50 max-h-64 overflow-y-auto">
                    {allCarsOverview.pitEvents.map((ev, idx) => (
                      <div
                        key={`pit-ev-${ev.carId}-${ev.stintLabel}-${idx}`}
                        className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs ${
                          ev.hasPitOverlap ? 'bg-amber-500/10' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-mono font-bold text-amber-300">
                            {formatMinutesToHHMM(ev.pitTimeMin)}
                          </span>
                          <span className={`h-2 w-2 rounded-full ${ev.preset.dotClass}`} />
                          <span className="font-bold text-white">{ev.carLabel}</span>
                          <span className="text-slate-400">({ev.stintLabel} • {ev.driver})</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          {ev.hasPitOverlap && (
                            <span className="rounded border border-amber-500/50 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-sans font-bold uppercase text-amber-300">
                              Janela Próxima
                            </span>
                          )}
                          <span className="text-emerald-300 font-bold">{ev.mfdTargetLabel}</span>
                          <span className="text-slate-300">{ev.scenarioLabel}</span>
                          <span className="text-slate-400">
                            Pit: {ev.stationarySec.toFixed(1)}s (+{ev.pitlaneLossSec}s)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {confirmDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setConfirmDialog(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[#334155] bg-[#0f172a] p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                  confirmDialog.tone === 'red'
                    ? 'border-red-500/40 bg-red-500/15 text-red-400'
                    : confirmDialog.tone === 'emerald'
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-[#22c55e]'
                    : 'border-amber-500/40 bg-amber-500/15 text-[#eab308]'
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{confirmDialog.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  {confirmDialog.message}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="rounded-lg border border-[#334155] bg-[#1e293b] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const fn = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  fn?.();
                }}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                  confirmDialog.tone === 'red'
                    ? 'bg-red-500 text-white hover:bg-red-400'
                    : confirmDialog.tone === 'emerald'
                    ? 'bg-[#22c55e] text-slate-950 hover:bg-emerald-400'
                    : 'bg-[#eab308] text-slate-950 hover:bg-amber-400'
                }`}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl border border-[#334155] bg-[#0f172a]/95 px-4 py-3 text-xs font-semibold shadow-2xl backdrop-blur-md">
          <span
            className={`h-2 w-2 rounded-full ${toast.type === 'error'
              ? 'bg-red-400'
              : toast.type === 'warning'
                ? 'bg-[#eab308]'
                : 'bg-[#22c55e]'
              }`}
          />
          <span className="text-slate-100">{toast.message}</span>
        </div>
      )}
      </div>
    </div>
  );
}

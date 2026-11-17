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
  Share2,
  Download,
  Upload,
  Radio,
  X,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';

const STORAGE_KEY = 'ftr_pitwall_strategy_v1';
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
  'Mauricio Chara',
  'Paulo Afonso',
  'Rafael Barison',
  'Vitor Justen',
  'Convidado 01',
  'Convidado 02',
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
        <svg width={s} height={s} viewBox="0 0 32 32" className="shrink-0">
          <path d="M7 4h18v12c0 7-9 12-9 12s-9-5-9-12V4z" fill="#facc15" stroke="#dc2626" strokeWidth="1.5" />
          <path d="M7 4h18v3H7z" fill="#16a34a" />
          <text x="16" y="21" textAnchor="middle" fontSize="10" fontWeight="900" fill="#0f172a" fontFamily="sans-serif">SF</text>
        </svg>
      );
    case 'porsche':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" className="shrink-0">
          <path d="M7 4h18v12c0 7-9 12-9 12s-9-5-9-12V4z" fill="#eab308" stroke="#fef08a" strokeWidth="1" />
          <path d="M8 5h8v8H8zM16 13h8v8h-8z" fill="#dc2626" />
          <path d="M16 5h8v8h-8zM8 13h8v8H8z" fill="#111827" />
          <text x="16" y="19" textAnchor="middle" fontSize="8" fontWeight="900" fill="#facc15" fontFamily="sans-serif">P</text>
        </svg>
      );
    case 'bmw':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" className="shrink-0">
          <circle cx="16" cy="16" r="12" fill="#0f172a" stroke="#e2e8f0" strokeWidth="1.5" />
          <path d="M16 6a10 10 0 0 1 10 10H16V6z" fill="#38bdf8" />
          <path d="M6 16a10 10 0 0 1 10-10v10H6z" fill="#f8fafc" />
          <path d="M16 16h10a10 10 0 0 1-10 10V16z" fill="#f8fafc" />
          <path d="M6 16h10v10A10 10 0 0 1 6 16z" fill="#38bdf8" />
        </svg>
      );
    case 'toyota':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" className="shrink-0">
          <rect x="3" y="6" width="26" height="20" rx="4" fill="#dc2626" />
          <text x="16" y="20" textAnchor="middle" fontSize="11" fontWeight="900" fill="#ffffff" fontFamily="sans-serif">GR</text>
        </svg>
      );
    case 'aston':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" className="shrink-0">
          <path d="M3 13l13-4 13 4-4 6H7l-4-6z" fill="#10b981" stroke="#a7f3d0" strokeWidth="1.2" />
          <text x="16" y="18" textAnchor="middle" fontSize="8" fontWeight="800" fill="#0f172a" fontFamily="sans-serif">AM</text>
        </svg>
      );
    case 'cadillac':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" className="shrink-0">
          <path d="M6 5h20l-2 15-8 7-8-7L6 5z" fill="#eab308" stroke="#fef08a" strokeWidth="1" />
          <rect x="9" y="8" width="7" height="6" fill="#dc2626" />
          <rect x="16" y="8" width="7" height="6" fill="#2563eb" />
          <rect x="9" y="14" width="7" height="5" fill="#111827" />
          <rect x="16" y="14" width="7" height="5" fill="#f8fafc" />
        </svg>
      );
    case 'alpine':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" className="shrink-0">
          <circle cx="16" cy="16" r="12" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
          <path d="M16 7l8 16h-4l-4-8-4 8H8l8-16z" fill="#ffffff" />
        </svg>
      );
    case 'peugeot':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" className="shrink-0">
          <path d="M7 5h18v11c0 7-9 11-9 11s-9-4-9-11V5z" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="1.4" />
          <text x="16" y="20" textAnchor="middle" fontSize="10" fontWeight="900" fill="#93c5fd" fontFamily="sans-serif">9X8</text>
        </svg>
      );
    case 'lamborghini':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" className="shrink-0">
          <path d="M7 5h18v12c0 6-9 10-9 10s-9-4-9-10V5z" fill="#111827" stroke="#eab308" strokeWidth="1.6" />
          <text x="16" y="20" textAnchor="middle" fontSize="10" fontWeight="900" fill="#eab308" fontFamily="sans-serif">LB</text>
        </svg>
      );
    case 'mclaren':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" className="shrink-0">
          <rect x="3" y="6" width="26" height="20" rx="4" fill="#0f172a" stroke="#f97316" strokeWidth="1.5" />
          <path d="M7 20c5-7 13-9 18-6-5 2-9 4-11 8-2-1-4-2-7-2z" fill="#f97316" />
        </svg>
      );
    case 'mercedes':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" className="shrink-0">
          <circle cx="16" cy="16" r="12" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1.5" />
          <path d="M16 5v11m0 0l-9 6m9-6l9 6" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'ford':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" className="shrink-0">
          <ellipse cx="16" cy="16" rx="13" ry="8" fill="#1d4ed8" stroke="#93c5fd" strokeWidth="1.4" />
          <text x="16" y="19" textAnchor="middle" fontSize="8" fontWeight="800" fill="#ffffff" fontFamily="serif" fontStyle="italic">Ford</text>
        </svg>
      );
    case 'corvette':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" className="shrink-0">
          <path d="M5 10l11 6 11-6-3 12-8-4-8 4-3-12z" fill="#eab308" stroke="#dc2626" strokeWidth="1.4" />
        </svg>
      );
    case 'lexus':
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" className="shrink-0">
          <ellipse cx="16" cy="16" rx="12" ry="9" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1.5" />
          <path d="M14 9l-3 10h9" stroke="#f8fafc" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        </svg>
      );
    default: {
      const tagMap = {
        oreca: { txt: 'OR', bg: '#0284c7', fg: '#ffffff' },
        ligier: { txt: 'LG', bg: '#2563eb', fg: '#ffffff' },
        duqueine: { txt: 'DQ', bg: '#7c3aed', fg: '#ffffff' },
        ginetta: { txt: 'GN', bg: '#ea580c', fg: '#ffffff' },
        adess: { txt: 'AD', bg: '#4f46e5', fg: '#ffffff' },
        genesis: { txt: 'GN', bg: '#b45309', fg: '#fef3c7' },
        glickenhaus: { txt: 'SCG', bg: '#dc2626', fg: '#ffffff' },
        isotta: { txt: 'IF', bg: '#0f766e', fg: '#ffffff' },
        vanwall: { txt: 'VW', bg: '#15803d', fg: '#ffffff' },
      };
      const cfg = tagMap[brand] || { txt: 'LMU', bg: '#334155', fg: '#f8fafc' };
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" className="shrink-0">
          <rect x="3" y="5" width="26" height="22" rx="5" fill={cfg.bg} />
          <text x="16" y="20" textAnchor="middle" fontSize="9.5" fontWeight="900" fill={cfg.fg} fontFamily="sans-serif">
            {cfg.txt}
          </text>
        </svg>
      );
    }
  }
}

const LMU_CIRCUITS = [
  { id: 'imola', name: 'Autodromo Internazionale Enzo e Dino Ferrari (Imola)', country: 'Itália' },
  { id: 'portimao', name: 'Autódromo Internacional do Algarve (Portimão)', country: 'Portugal' },
  { id: 'interlagos', name: 'Autódromo José Carlos Pace (Interlagos)', country: 'Brasil' },
  { id: 'monza', name: 'Autodromo Nazionale Monza', country: 'Itália' },
  { id: 'bahrain', name: 'Bahrain International Circuit', country: 'Bahrein' },
  { id: 'barcelona', name: 'Circuit de Barcelona-Catalunya', country: 'Espanha' },
  { id: 'lemans', name: 'Circuit de la Sarthe (Le Mans)', country: 'França' },
  { id: 'spa', name: 'Circuit de Spa-Francorchamps', country: 'Bélgica' },
  { id: 'cota', name: 'Circuit of the Americas (COTA)', country: 'EUA' },
  { id: 'paul-ricard', name: 'Circuit Paul Ricard', country: 'França' },
  { id: 'daytona', name: 'Daytona International Speedway', country: 'EUA' },
  { id: 'fuji', name: 'Fuji Speedway', country: 'Japão' },
  { id: 'lusail', name: 'Lusail International Circuit (Qatar)', country: 'Catar' },
  { id: 'road-atlanta', name: 'Michelin Raceway Road Atlanta', country: 'EUA' },
  { id: 'sebring', name: 'Sebring International Raceway', country: 'EUA' },
  { id: 'silverstone', name: 'Silverstone Circuit', country: 'Reino Unido' },
  { id: 'long-beach', name: 'Streets of Long Beach', country: 'EUA' },
  { id: 'laguna-seca', name: 'WeatherTech Raceway Laguna Seca', country: 'EUA' },
];

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

const DEFAULT_PARAMS = {
  carClass: 'Hypercar',
  carId: 'ferrari-499p',
  circuitId: 'monza',
  sessionStart: '14:00',
  raceDurationStr: '06:00',
  lapTimeStr: '01:45.320',
  tankCapacityL: 100,
  fuelPerLapL: 3.1,
  virtualEnergyPerLapPct: 2.1,
  fpDurationMin: 5,
  qualyDurationMin: 15,
  availableTires: 24,
  pitTime4TiresSec: 45,
  pitTime2TiresSec: 35,
  pitTimeFuelOnlySec: 25,
  pitTimeDriverOnlySec: 15,
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

function getPitTimeSeconds(scenarioId, params) {
  switch (scenarioId) {
    case '4_tires_fuel':
      return Math.max(0, Number(params.pitTime4TiresSec) || 0);
    case '2_tires_fuel':
      return Math.max(0, Number(params.pitTime2TiresSec) || 0);
    case 'fuel_only':
      return Math.max(0, Number(params.pitTimeFuelOnlySec) || 0);
    case 'driver_swap_only':
      return Math.max(0, Number(params.pitTimeDriverOnlySec) || 0);
    default:
      return 0;
  }
}

function StartTireToggleButton({ corner, tireMeta, onToggle }) {
  const mode = tireMeta?.mode || 'new';
  const tireId = tireMeta?.tireId || '';
  const pct = tireMeta?.pct;
  const sourceLabel = tireMeta?.sourceLabel;

  let displayValue = 'NOVO';
  if (mode === 'keep') {
    displayValue = pct === 'ND' || pct === null || pct === undefined ? 'MANTER' : `MANT ${pct}%`;
  } else if (mode === 'used') {
    displayValue = pct === 'ND' || pct === null || pct === undefined ? 'ND' : `${pct}%`;
  }

  const colorClasses =
    mode === 'new'
      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 hover:border-emerald-400 hover:bg-emerald-500/25'
      : mode === 'keep'
        ? 'bg-sky-500/15 text-sky-300 border-sky-500/40 hover:border-sky-400 hover:bg-sky-500/25'
        : 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:border-amber-400 hover:bg-amber-500/25';

  const tooltip =
    mode === 'new'
      ? `Pneu ${corner} ${tireId} (NOVO) — Clique para alternar (Manter / Usado)`
      : mode === 'keep'
        ? `Pneu ${corner} ${tireId} (MANTIDO de ${sourceLabel || 'stint anterior'} • ${pct === 'ND' ? 'ND' : `${pct}%`
        }) — Clique para usar outro pneu usado`
        : `Pneu ${corner} ${tireId} (USADO • ${sourceLabel ? `${displayValue} de ${sourceLabel}` : displayValue
        }) — Clique para trocar por NOVO`;

  return (
    <button
      type="button"
      onClick={onToggle}
      title={tooltip}
      className={`flex w-full flex-col items-center justify-center rounded-md border px-2 py-1.5 text-xs font-mono font-semibold transition-all cursor-pointer min-w-[58px] ${colorClasses}`}
    >
      <span className="text-[10px] uppercase tracking-wider opacity-90 leading-none">
        {corner} {tireId}
      </span>
      <span className="tabular-nums leading-tight mt-1 text-[11px] font-bold">{displayValue}</span>
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
        <div className="absolute right-0 top-full z-50 mt-1.5 w-48 rounded-lg border border-slate-600 bg-slate-900 p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-200">
            <span>Pneu {corner}</span>
            <span className={`font-mono tabular-nums ${getTireTextColor(numericVal)}`}>
              {numericVal}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={numericVal}
            onChange={(e) => onChange(Number(e.target.value))}
            className="mb-2 w-full accent-amber-500 cursor-pointer"
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
      )}
    </div>
  );
}

function loadInitialStrategyState() {
  const fallback = {
    params: DEFAULT_PARAMS,
    preSessions: DEFAULT_PRE_SESSIONS,
    stintOverrides: DEFAULT_STINT_OVERRIDES,
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
          const merged = {
            params: { ...DEFAULT_PARAMS, ...(parsed.params || {}) },
            preSessions: { ...DEFAULT_PRE_SESSIONS, ...(parsed.preSessions || {}) },
            stintOverrides: parsed.stintOverrides || DEFAULT_STINT_OVERRIDES,
          };
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
          params: { ...DEFAULT_PARAMS, ...(parsed.params || {}) },
          preSessions: { ...DEFAULT_PRE_SESSIONS, ...(parsed.preSessions || {}) },
          stintOverrides: parsed.stintOverrides || DEFAULT_STINT_OVERRIDES,
          loadedFromUrl: false,
        };
      }
    }
  } catch {
    // ignore storage errors
  }

  return fallback;
}

export default function App() {
  const initialStateRef = useRef(null);
  if (!initialStateRef.current) {
    initialStateRef.current = loadInitialStrategyState();
  }

  const [params, setParams] = useState(() => initialStateRef.current.params);
  const [preSessions, setPreSessions] = useState(() => initialStateRef.current.preSessions);
  const [stintOverrides, setStintOverrides] = useState(
    () => initialStateRef.current.stintOverrides
  );

  const [copied, setCopied] = useState(false);
  const [mobileParamsOpen, setMobileParamsOpen] = useState(true);
  const [collapsedStints, setCollapsedStints] = useState({});
  const [toast, setToast] = useState(() =>
    initialStateRef.current.loadedFromUrl
      ? { message: 'Estratégia carregada pelo link compartilhado!', type: 'success' }
      : null
  );

  const [roomPin, setRoomPin] = useState(() => {
    try {
      return localStorage.getItem(ROOM_PIN_STORAGE_KEY) || 'FTR2026';
    } catch {
      return 'FTR2026';
    }
  });
  const [pinDraft, setPinDraft] = useState(roomPin);
  const [liveRoomEnabled, setLiveRoomEnabled] = useState(false);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState('local'); // 'local' | 'connecting' | 'live' | 'error'

  const fileInputRef = useRef(null);
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

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ params, preSessions, stintOverrides })
      );
    } catch {
      // ignore quota errors
    }
  }, [params, preSessions, stintOverrides]);

  // Supabase Realtime Subscription (when configured and live room enabled)
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !liveRoomEnabled || !roomPin.trim()) {
      setSyncStatus('local');
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
          const remote = data.strategy_data;
          if (remote.params) setParams({ ...DEFAULT_PARAMS, ...remote.params });
          if (remote.preSessions) setPreSessions({ ...DEFAULT_PRE_SESSIONS, ...remote.preSessions });
          if (remote.stintOverrides) setStintOverrides(remote.stintOverrides);
          setTimeout(() => {
            isApplyingRemoteRef.current = false;
          }, 50);
        } else {
          await supabase.from('race_strategies').upsert(
            {
              room_pin: activePin,
              strategy_data: { params, preSessions, stintOverrides },
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
      .channel(`pitwall-room-${activePin}`)
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
          const remote = record.strategy_data;
          if (remote.params) setParams({ ...DEFAULT_PARAMS, ...remote.params });
          if (remote.preSessions) setPreSessions({ ...DEFAULT_PRE_SESSIONS, ...remote.preSessions });
          if (remote.stintOverrides) setStintOverrides(remote.stintOverrides);
          setTimeout(() => {
            isApplyingRemoteRef.current = false;
          }, 50);
        }
      )
      .subscribe((status) => {
        if (cancelled) return;
        if (status === 'SUBSCRIBED') {
          setSyncStatus('live');
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
            strategy_data: { params, preSessions, stintOverrides },
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
  }, [params, preSessions, stintOverrides, liveRoomEnabled, syncStatus, roomPin]);

  const handleParamChange = (key, value) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setParams(DEFAULT_PARAMS);
    setPreSessions(DEFAULT_PRE_SESSIONS);
    setStintOverrides(DEFAULT_STINT_OVERRIDES);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  // Calculations: Fuel Ratio & Stint Autonomy
  const telemetry = useMemo(() => {
    const lapTimeSec = parseLapTimeToSeconds(params.lapTimeStr);
    const tankL = Math.max(1, Number(params.tankCapacityL) || 100);
    const fuelPerLap = Math.max(0.1, Number(params.fuelPerLapL) || 3.1);
    const energyPerLap = Math.max(0.1, Number(params.virtualEnergyPerLapPct) || 2.1);

    const fuelRatio = fuelPerLap / energyPerLap;
    const maxLapsByFuel = Math.floor(tankL / fuelPerLap);
    const maxLapsByEnergy = Math.floor(100 / energyPerLap);
    const maxStintLaps = Math.max(1, Math.min(maxLapsByFuel, maxLapsByEnergy));
    const limitingFactor = maxLapsByFuel <= maxLapsByEnergy ? 'Tanque' : 'Energia Virtual';
    const maxStintMin = (maxStintLaps * lapTimeSec) / 60;

    return {
      lapTimeSec,
      fuelRatio,
      maxLapsByFuel,
      maxLapsByEnergy,
      maxStintLaps,
      limitingFactor,
      maxStintMin,
    };
  }, [params]);

  // Build Schedule: Free Practice -> Qualy -> Dynamic Race Stints
  const schedule = useMemo(() => {
    const rows = [];
    let cursorMin = parseTimeToMinutes(params.sessionStart);

    const fpDur = Math.max(0, Number(params.fpDurationMin) || 0);
    const fpLaps = Math.floor((fpDur * 60) / telemetry.lapTimeSec);
    rows.push({
      id: 'fp',
      type: 'fp',
      label: 'Free Practice',
      durationMin: fpDur,
      laps: fpLaps,
      startMin: cursorMin,
      endMin: cursorMin + fpDur,
      driver: preSessions.fp.driver,
      pitScenario: null,
      pitDurationSec: 0,
      tiresStart: DEFAULT_FULL_TIRES,
      tiresEnd: DEFAULT_FULL_TIRES,
    });
    cursorMin += fpDur;

    const qualyDur = Math.max(0, Number(params.qualyDurationMin) || 0);
    const qualyLaps = Math.floor((qualyDur * 60) / telemetry.lapTimeSec);
    rows.push({
      id: 'qualy',
      type: 'qualy',
      label: 'Qualy',
      durationMin: qualyDur,
      laps: qualyLaps,
      startMin: cursorMin,
      endMin: cursorMin + qualyDur,
      driver: preSessions.qualy.driver,
      pitScenario: null,
      pitDurationSec: 0,
      tiresStart: preSessions.qualy.tiresStart || DEFAULT_FULL_TIRES,
      tiresEnd: preSessions.qualy.tiresEnd || preSessions.qualy.tires || { FL: 88, FR: 84, RL: 90, RR: 89 },
      tiresEndEnabled: Boolean(preSessions.qualy.tiresEndEnabled),
    });
    cursorMin += qualyDur;

    const totalRaceMin = parseDurationHHMMToMinutes(params.raceDurationStr);
    let remainingRaceMin = totalRaceMin;
    let stintNum = 1;
    const maxStintsGuard = 60;

    while (remainingRaceMin > 0.05 && stintNum <= maxStintsGuard) {
      const override = stintOverrides[stintNum] || {};
      const defaultDriver = DRIVERS[(stintNum - 1) % DRIVERS.length];
      const driver = override.driver || defaultDriver;
      const pitScenario = override.pitScenario || '4_tires_fuel';
      const tiresStart = override.tiresStart || DEFAULT_FULL_TIRES;
      const tiresEnd = override.tiresEnd || override.tires || { FL: 72, FR: 68, RL: 76, RR: 74 };
      const tiresEndEnabled = Boolean(override.tiresEndEnabled);

      const rawStintMin = Math.min(telemetry.maxStintMin, remainingRaceMin);
      const stintLaps = Math.max(1, Math.round((rawStintMin * 60) / telemetry.lapTimeSec));
      const startMin = cursorMin;
      const endMin = startMin + rawStintMin;

      const isLastStint = remainingRaceMin - rawStintMin <= 0.05;
      const pitDurationSec = isLastStint ? 0 : getPitTimeSeconds(pitScenario, params);
      const pitDurationMin = pitDurationSec / 60;

      rows.push({
        id: `stint_${stintNum}`,
        type: 'race',
        stintNum,
        label: `Stint ${String(stintNum).padStart(2, '0')}`,
        durationMin: rawStintMin,
        laps: stintLaps,
        startMin,
        endMin,
        driver,
        pitScenario,
        pitDurationSec,
        isLastStint,
        tiresStart,
        tiresEnd,
        tiresEndEnabled,
      });

      remainingRaceMin -= rawStintMin;
      if (!isLastStint) {
        // Advance clock by pitstop time and deduct pit time from remaining race clock
        cursorMin = endMin + pitDurationMin;
        remainingRaceMin = Math.max(0, remainingRaceMin - pitDurationMin);
      } else {
        cursorMin = endMin;
      }

      stintNum += 1;
    }

    return rows;
  }, [params, preSessions, stintOverrides, telemetry]);

  // Sequential physical tire tracking (#1, #2, #3...) individually across all tires
  const { enrichedSchedule, tireBankByCorner } = useMemo(() => {
    let globalTireNum = 1;
    const bank = { FL: [], FR: [], RL: [], RR: [] };
    const prevMounted = { FL: null, FR: null, RL: null, RR: null };

    const enriched = schedule.map((row) => {
      if (row.type === 'fp') {
        return { ...row, startTireMeta: null, endTireMeta: null };
      }

      const startTireMeta = {};
      const endTireMeta = {};

      TIRE_CORNERS.forEach(({ key }) => {
        const rawStart = row.tiresStart?.[key];
        const canKeep = Boolean(prevMounted[key]);
        const isKeep = rawStart === 'keep' && canKeep;
        const isNew = rawStart === 100 || rawStart === 'new';

        if (isNew) {
          const num = globalTireNum++;
          const tire = {
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
            canKeep,
            tireNum: chosen.num,
            tireId: chosen.id,
            pct: startPct,
            sourceLabel,
          };
          endTireMeta[key] = { tireNum: chosen.num, tireId: chosen.id };
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
  }, [schedule]);

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
      };
    });

    return result;
  }, [tireBankByCorner]);

  const updatePreSession = (sessionKey, field, value) => {
    setPreSessions((prev) => ({
      ...prev,
      [sessionKey]: {
        ...prev[sessionKey],
        [field]: value,
      },
    }));
  };

  const updatePreSessionTire = (sessionKey, phase, corner, pct) => {
    setPreSessions((prev) => {
      const current = prev[sessionKey];
      const existingPhase = current[phase] || current.tires || DEFAULT_FULL_TIRES;
      return {
        ...prev,
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
    setStintOverrides((prev) => {
      const current = prev[stintNum] || {
        driver: DRIVERS[(stintNum - 1) % DRIVERS.length],
        pitScenario: '4_tires_fuel',
        tiresStart: DEFAULT_FULL_TIRES,
        tiresEnd: { FL: 72, FR: 68, RL: 76, RR: 74 },
      };
      return {
        ...prev,
        [stintNum]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  const updateRaceStintTire = (stintNum, phase, corner, pct) => {
    setStintOverrides((prev) => {
      const current = prev[stintNum] || {
        driver: DRIVERS[(stintNum - 1) % DRIVERS.length],
        pitScenario: '4_tires_fuel',
        tiresStart: DEFAULT_FULL_TIRES,
        tiresEnd: { FL: 72, FR: 68, RL: 76, RR: 74 },
      };
      const existingPhase =
        current[phase] ||
        (phase === 'tiresStart' ? DEFAULT_FULL_TIRES : current.tires || { FL: 72, FR: 68, RL: 76, RR: 74 });
      return {
        ...prev,
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

  const toggleStintCollapse = (rowId) => {
    setCollapsedStints((prev) => ({ ...prev, [rowId]: !prev[rowId] }));
  };

  const areAllStintsCollapsed =
    enrichedSchedule.length > 0 && enrichedSchedule.every((r) => Boolean(collapsedStints[r.id]));

  const toggleAllStintsCollapse = () => {
    if (areAllStintsCollapsed) {
      setCollapsedStints({});
    } else {
      const next = {};
      enrichedSchedule.forEach((r) => {
        next[r.id] = true;
      });
      setCollapsedStints(next);
    }
  };

  const handleShareLink = async () => {
    try {
      const payload = JSON.stringify({ params, preSessions, stintOverrides });
      const compressed = LZString.compressToEncodedURIComponent(payload);
      const shareUrl = `${window.location.origin}${window.location.pathname}?s=${compressed}`;
      await navigator.clipboard.writeText(shareUrl);
      showToast('Link da estratégia copiado!', 'success');
    } catch {
      showToast('Não foi possível copiar o link.', 'error');
    }
  };

  const handleExportJson = () => {
    try {
      const payload = {
        app: 'FTR PITWALL',
        version: 1,
        exportedAt: new Date().toISOString(),
        params,
        preSessions,
        stintOverrides,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ftr-pitwall-${selectedCircuit.id}-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Backup JSON exportado!', 'success');
    } catch {
      showToast('Erro ao exportar JSON.', 'error');
    }
  };

  const handleImportJson = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(String(e.target?.result || ''));
        if (!parsed || typeof parsed !== 'object' || !parsed.params) {
          showToast('Arquivo JSON inválido.', 'error');
          return;
        }
        setParams({ ...DEFAULT_PARAMS, ...parsed.params });
        if (parsed.preSessions) {
          setPreSessions({ ...DEFAULT_PRE_SESSIONS, ...parsed.preSessions });
        }
        if (parsed.stintOverrides) {
          setStintOverrides(parsed.stintOverrides);
        }
        showToast('Estratégia importada do JSON!', 'success');
      } catch {
        showToast('Não foi possível ler o arquivo JSON.', 'error');
      }
    };
    reader.readAsText(file);
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
      `🏎️ *Carro:* [${selectedClassMeta.label}] ${selectedCar.name}`,
      `⏱️ *Início:* ${params.sessionStart} | *Corrida:* ${params.raceDurationStr} (${totalRaceMin} min)`,
      `⛽ *Fuel Ratio:* ${telemetry.fuelRatio.toFixed(2)} L/% | *Autonomia Máx:* ${telemetry.maxStintLaps} voltas (~${telemetry.maxStintMin.toFixed(1)} min)`,
      `⏱️ *Volta Base:* ${params.lapTimeStr}`,
      ``,
      `📋 *CRONOGRAMA DE STINTS:*`,
    ];

    enrichedSchedule.forEach((row) => {
      const timeRange = `${formatMinutesToHHMM(row.startMin)} - ${formatMinutesToHHMM(row.endMin)}`;
      const pitInfo =
        row.type === 'race' && !row.isLastStint
          ? ` | Pit: ${PIT_SCENARIOS.find((p) => p.id === row.pitScenario)?.label} (${row.pitDurationSec}s)`
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

  const raceStintCount = schedule.filter((r) => r.type === 'race').length;
  const totalEstimatedLaps = schedule
    .filter((r) => r.type === 'race')
    .reduce((acc, r) => acc + r.laps, 0);

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
  const nextEvent = useMemo(
    () => calendarEvents.find((e) => e.status === 'next') || calendarEvents[calendarEvents.length - 1],
    [calendarEvents]
  );

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

      {nextEvent && (
        <div className="mb-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#eab308]">
            <Sparkles className="h-3 w-3" />
            <span>Próximo Evento</span>
          </div>
          <div className="mt-1 text-sm font-bold text-white">
            {nextEvent.track} — {nextEvent.dates}
          </div>
          <div className="text-[11px] text-amber-200/80">
            {nextEvent.classes}
          </div>
        </div>
      )}

      <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
        {calendarEvents.map((ev) => (
          <div
            key={ev.id}
            className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs ${
              ev.status === 'next'
                ? 'bg-amber-500/15 border border-amber-500/30 text-amber-200 font-semibold'
                : ev.status === 'past'
                ? 'text-slate-500 line-through'
                : 'text-slate-300 bg-[#0f172a]/50'
            }`}
          >
            <span className="truncate pr-2">{ev.track}</span>
            <span className="shrink-0 font-mono text-[11px]">{ev.dates}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col">
      {/* TOP BAR */}
      <header className="sticky top-0 z-40 border-b border-[#334155] bg-[#0f172a]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/10 text-[#eab308]">
              <Flag className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight text-white sm:text-xl">
                  FTR <span className="text-[#eab308]">PITWALL</span>
                </h1>
                <span className="hidden rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#22c55e] sm:inline-block">
                  LMU Protótipo
                </span>
              </div>
              <p className="text-xs text-slate-400">Endurance Strategist • Engenharia de Corrida</p>
            </div>
          </div>

          {nextEvent && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#eab308]" />
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#eab308] mr-1.5">
                  Próxima Corrida:
                </span>
                <span className="font-bold text-white">{nextEvent.track}</span>
                <span className="ml-1.5 font-mono text-[11px] text-amber-200">
                  ({nextEvent.dates})
                </span>
              </div>
            </div>
          )}

          <div className="hidden xl:flex items-center gap-2.5 rounded-lg border border-[#334155] bg-[#1e293b]/90 px-3 py-1.5">
            <ManufacturerLogo brand={selectedCar.brand} size={26} />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white">{selectedCar.name}</span>
                <span
                  className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${selectedClassMeta.badgeClass}`}
                >
                  {selectedClassMeta.label}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <MapPin className="h-2.5 w-2.5 text-[#eab308]" />
                <span className="truncate max-w-[260px]">{selectedCircuit.name}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Connection Status Pill */}
            <div
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${syncStatus === 'live'
                ? 'border-emerald-500/40 bg-emerald-500/15 text-[#22c55e]'
                : 'border-amber-500/40 bg-amber-500/10 text-[#eab308]'
                }`}
              title={
                syncStatus === 'live'
                  ? `Conectado à sala ${roomPin}`
                  : 'Salvamento local automático (offline fallback)'
              }
            >
              <span
                className={`h-2 w-2 rounded-full ${syncStatus === 'live' ? 'bg-[#22c55e] animate-pulse' : 'bg-[#eab308]'
                  }`}
              />
              <span>{syncStatus === 'live' ? 'Sincronizado ao Vivo' : 'Modo Local'}</span>
            </div>

            {/* Live Room (PIN) Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setPinDraft(roomPin);
                  setRoomModalOpen((prev) => !prev);
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${syncStatus === 'live'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                  : 'border-[#334155] bg-[#1e293b] text-slate-300 hover:border-slate-500 hover:text-white'
                  }`}
                title="Configurar Sala Ao Vivo (PIN)"
              >
                <Radio className="h-3.5 w-3.5 text-[#eab308]" />
                <span className="hidden md:inline">Sala Ao Vivo:</span>
                <span className="font-mono text-[11px] font-bold text-white">{roomPin}</span>
              </button>

              {roomModalOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-[#334155] bg-[#0f172a] p-4 shadow-2xl">
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
                        placeholder="FTR2026"
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
                            setSyncStatus('local');
                            setRoomModalOpen(false);
                            showToast('Desconectado da sala. Modo Local ativo.', 'warning');
                          }}
                          className="rounded-lg border border-[#334155] bg-[#1e293b] px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
                        >
                          Sair
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* JSON Backup (Export / Import) */}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportJson}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleExportJson}
              title="Exportar backup JSON"
              className="inline-flex items-center gap-1 rounded-lg border border-[#334155] bg-[#1e293b] px-2.5 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-500 hover:text-white cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-slate-400" />
              <span className="hidden lg:inline">Exportar JSON</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Importar backup JSON"
              className="inline-flex items-center gap-1 rounded-lg border border-[#334155] bg-[#1e293b] px-2.5 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-500 hover:text-white cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5 text-slate-400" />
              <span className="hidden lg:inline">Importar JSON</span>
            </button>

            <button
              type="button"
              onClick={handleShareLink}
              title="Copiar link compartilhável da estratégia"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-[#22c55e] transition-colors hover:border-emerald-400 hover:bg-emerald-500/25 cursor-pointer"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Compartilhar Link</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#334155] bg-[#1e293b] px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-500 hover:text-white cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
              <span className="hidden sm:inline">Resetar Estratégia</span>
            </button>

            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${copied
                ? 'border-emerald-500/60 bg-emerald-500/20 text-[#22c55e]'
                : 'border-amber-500/50 bg-[#eab308] text-slate-950 hover:bg-amber-400'
                }`}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Copiado p/ WhatsApp!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Copiar WhatsApp</span>
                  <span className="sm:hidden">WhatsApp</span>
                </>
              )}
            </button>

            {/* Mobile-only best tire reuse summary next to WhatsApp */}
            <div className="sm:hidden flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-[#1e293b] px-2.5 py-1.5 text-[10px] font-mono">
              <Disc className="h-3.5 w-3.5 shrink-0 text-[#22c55e]" />
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {TIRE_CORNERS.map(({ key }) => {
                  const best = tireRecommendations[key]?.best;
                  return (
                    <span key={`mob-rec-${key}`} className="tabular-nums">
                      <span className="text-slate-400">{key}:</span>{' '}
                      {best ? (
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
          </div>
        </div>
      </header>

      {/* MAIN 2-COLUMN WORKSPACE */}
      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-5 p-4 sm:p-6 lg:flex-row">
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

            <div className={`${mobileParamsOpen ? 'block' : 'hidden'} lg:block p-4 space-y-4`}>
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
                    <div className="mt-0.5 truncate text-xs font-bold text-white">
                      {selectedCar.name}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
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
                  <select
                    value={selectedCircuit.id}
                    onChange={(e) => handleParamChange('circuitId', e.target.value)}
                    className="w-full rounded-md border border-[#334155] bg-[#1e293b] px-2 py-1.5 text-xs font-medium text-slate-100 focus:border-[#eab308] focus:outline-none cursor-pointer"
                  >
                    {LMU_CIRCUITS.map((circuit) => (
                      <option key={circuit.id} value={circuit.id}>
                        {circuit.name} ({circuit.country})
                      </option>
                    ))}
                  </select>
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
                  <input
                    type="text"
                    placeholder="06:00"
                    value={params.raceDurationStr}
                    onChange={(e) => handleParamChange('raceDurationStr', e.target.value)}
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <Gauge className="h-3 w-3 text-[#22c55e]" />
                    Tempo de Volta
                  </label>
                  <input
                    type="text"
                    placeholder="01:45.320"
                    value={params.lapTimeStr}
                    onChange={(e) => handleParamChange('lapTimeStr', e.target.value)}
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <Fuel className="h-3 w-3 text-[#eab308]" />
                    Tanque (Litros)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={params.tankCapacityL}
                    onChange={(e) =>
                      handleParamChange('tankCapacityL', Math.max(1, Number(e.target.value) || 0))
                    }
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <Fuel className="h-3 w-3 text-slate-400" />
                    Consumo (L/volta)
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={params.fuelPerLapL}
                    onChange={(e) =>
                      handleParamChange('fuelPerLapL', Math.max(0.1, Number(e.target.value) || 0.1))
                    }
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <Zap className="h-3 w-3 text-[#22c55e]" />
                    Energia Virt. (%/v)
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={params.virtualEnergyPerLapPct}
                    onChange={(e) =>
                      handleParamChange(
                        'virtualEnergyPerLapPct',
                        Math.max(0.1, Number(e.target.value) || 0.1)
                      )
                    }
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-400">
                    Free Practice (min)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={params.fpDurationMin}
                    onChange={(e) =>
                      handleParamChange('fpDurationMin', Math.max(0, Number(e.target.value) || 0))
                    }
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-400">
                    Qualy (min)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={params.qualyDurationMin}
                    onChange={(e) =>
                      handleParamChange('qualyDurationMin', Math.max(0, Number(e.target.value) || 0))
                    }
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
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={params.availableTires ?? 24}
                    onChange={(e) =>
                      handleParamChange('availableTires', Math.max(0, Number(e.target.value) || 0))
                    }
                    className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                  />
                </div>
              </div>

              {/* Pitstop Times */}
              <div className="border-t border-[#334155] pt-3">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  <Wrench className="h-3.5 w-3.5 text-[#eab308]" />
                  <span>Tempos Médios de Pitstop (seg)</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-400">Combustível + 4 Pneus + Piloto</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        value={params.pitTime4TiresSec}
                        onChange={(e) =>
                          handleParamChange(
                            'pitTime4TiresSec',
                            Math.max(0, Number(e.target.value) || 0)
                          )
                        }
                        className="w-16 rounded-md border border-[#334155] bg-[#0f172a] px-2 py-1 text-right text-xs font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                      />
                      <span className="text-xs text-slate-500">s</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-400">Combustível + 2 Pneus + Piloto</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        value={params.pitTime2TiresSec}
                        onChange={(e) =>
                          handleParamChange(
                            'pitTime2TiresSec',
                            Math.max(0, Number(e.target.value) || 0)
                          )
                        }
                        className="w-16 rounded-md border border-[#334155] bg-[#0f172a] px-2 py-1 text-right text-xs font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                      />
                      <span className="text-xs text-slate-500">s</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-400">Apenas Combustível + Piloto</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        value={params.pitTimeFuelOnlySec}
                        onChange={(e) =>
                          handleParamChange(
                            'pitTimeFuelOnlySec',
                            Math.max(0, Number(e.target.value) || 0)
                          )
                        }
                        className="w-16 rounded-md border border-[#334155] bg-[#0f172a] px-2 py-1 text-right text-xs font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                      />
                      <span className="text-xs text-slate-500">s</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-400">Somente Troca de Piloto</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        value={params.pitTimeDriverOnlySec}
                        onChange={(e) =>
                          handleParamChange(
                            'pitTimeDriverOnlySec',
                            Math.max(0, Number(e.target.value) || 0)
                          )
                        }
                        className="w-16 rounded-md border border-[#334155] bg-[#0f172a] px-2 py-1 text-right text-xs font-mono tabular-nums text-slate-100 focus:border-[#eab308] focus:outline-none"
                      />
                      <span className="text-xs text-slate-500">s</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* HIGHLIGHT CARD: FUEL RATIO & AUTONOMY */}
          <div className="rounded-xl border border-amber-500/40 bg-gradient-to-br from-[#1e293b] to-[#0f172a] p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#eab308]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#eab308]">
                  Fuel Ratio & Autonomia
                </h2>
              </div>
              <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/30">
                Limite: {telemetry.limitingFactor}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
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
              <span>•</span>
              <span>Energia 100%: {telemetry.maxLapsByEnergy}v</span>
              <span>•</span>
              <span className="text-slate-200 font-semibold">{raceStintCount} stints</span>
            </div>
          </div>

          {/* BOTTOM CARD: LMU CALENDAR Q3/Q4 2026 (Desktop Sidebar) */}
          <div className="hidden lg:block">{calendarCard}</div>
        </aside>

        {/* RIGHT MAIN AREA: STINTS TABLE & TIRE MANAGER */}
        <section className="flex-1 min-w-0 space-y-5">
          {/* SUMMARY BAR */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
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
                {schedule[0] ? formatMinutesToHHMM(schedule[0].startMin) : '--:--'} →{' '}
                {schedule[schedule.length - 1]
                  ? formatMinutesToHHMM(schedule[schedule.length - 1].endMin)
                  : '--:--'}
              </div>
            </div>
            <div className="rounded-xl border border-[#334155] bg-[#1e293b] px-4 py-3">
              <div className="text-[11px] text-slate-400">Pilotos Ativos</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xl font-bold font-mono tabular-nums text-[#eab308]">
                <Users className="h-4 w-4" />
                <span>{new Set(schedule.map((s) => s.driver)).size}</span>
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
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#eab308]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Cronograma de Sessões & Stints
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline text-[11px] text-slate-400">
                  Clique nos badges de pneus (<span className="font-mono text-slate-200">FL/FR/RL/RR</span>) para editar
                </span>
                <button
                  type="button"
                  onClick={toggleAllStintsCollapse}
                  className="inline-flex items-center gap-1 rounded-md border border-[#334155] bg-[#0f172a] px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition-colors hover:border-[#eab308]/60 hover:text-[#eab308] cursor-pointer"
                >
                  {areAllStintsCollapsed ? (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" />
                      <span>Expandir Tudo</span>
                    </>
                  ) : (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" />
                      <span>Empacotar Tudo</span>
                    </>
                  )}
                </button>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#334155]/60">
                  {enrichedSchedule.map((row) => {
                    const isPre = row.type !== 'race';
                    const isCollapsed = Boolean(collapsedStints[row.id]);
                    const nextStintLabel = `Stint ${String((row.stintNum || 0) + 1).padStart(2, '0')}`;
                    return (
                      <React.Fragment key={row.id}>
                        {isCollapsed ? (
                          <tr
                            className={`transition-colors ${isPre
                              ? 'bg-slate-900/40 hover:bg-slate-900/70'
                              : 'hover:bg-slate-800/70'
                              }`}
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
                                  <span className="font-bold text-slate-100">{row.label}</span>
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
                                    Pit: {PIT_SCENARIOS.find((p) => p.id === row.pitScenario)?.label} ({row.pitDurationSec}s)
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <>
                            <tr
                              className={`transition-colors ${isPre
                                ? 'bg-slate-900/40 hover:bg-slate-900/70'
                                : 'hover:bg-slate-800/70'
                                }`}
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
                                  <span className="font-bold text-slate-100">{row.label}</span>
                                </div>
                                <div className="mt-0.5 pl-9 font-mono tabular-nums text-[11px] text-slate-400">
                                  {formatMinutesToHHMM(row.startMin)} - {formatMinutesToHHMM(row.endMin)}
                                  {row.type === 'race' && !row.isLastStint && (
                                    <span className="ml-1.5 text-amber-400/90">
                                      (+{row.pitDurationSec}s pit)
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
                                    {DRIVERS.map((d) => (
                                      <option key={d} value={d}>
                                        {d}
                                      </option>
                                    ))}
                                  </select>
                                </div>
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
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (row.type === 'race') {
                                          updateRaceStint(row.stintNum, 'tiresStart', DEFAULT_FULL_TIRES);
                                        } else {
                                          updatePreSession(row.type, 'tiresStart', DEFAULT_FULL_TIRES);
                                        }
                                      }}
                                      className="inline-flex items-center justify-center rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300 transition-colors hover:border-emerald-400 hover:bg-emerald-500/20 cursor-pointer"
                                    >
                                      4 Pneus Novos
                                    </button>
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
                                            onToggle={() => {
                                              if (tireMeta?.mode === 'new') {
                                                setStartVal(tireMeta?.canKeep ? 'keep' : 'ND');
                                              } else if (tireMeta?.mode === 'keep') {
                                                setStartVal('ND');
                                              } else {
                                                setStartVal(100);
                                              }
                                            }}
                                          />
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </td>

                              {/* PNEUS FIM */}
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                {row.type === 'fp' ? (
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
                            </tr>

                            {row.type === 'race' && !row.isLastStint && (
                              <tr className="bg-amber-500/5 border-y border-amber-500/20">
                                <td colSpan={4} className="px-3 py-1.5">
                                  <div className="flex items-center gap-2 text-[11px]">
                                    <Wrench className="h-3.5 w-3.5 text-[#eab308]" />
                                    <span className="font-bold uppercase tracking-wider text-[#eab308]">
                                      Pitstop
                                    </span>
                                    <span className="text-slate-400">
                                      {row.label} → {nextStintLabel}
                                    </span>
                                    <span className="font-mono text-slate-300">
                                      ({formatMinutesToHHMM(row.endMin)})
                                    </span>
                                  </div>
                                </td>
                                <td colSpan={2} className="px-3 py-1.5 text-center">
                                  <select
                                    value={row.pitScenario}
                                    onChange={(e) =>
                                      updateRaceStint(row.stintNum, 'pitScenario', e.target.value)
                                    }
                                    className="mx-auto rounded-md border border-amber-500/35 bg-[#0f172a] px-2.5 py-1 text-xs font-medium text-slate-100 focus:border-[#eab308] focus:outline-none cursor-pointer"
                                  >
                                    {PIT_SCENARIOS.map((sc) => (
                                      <option key={sc.id} value={sc.id}>
                                        {sc.label} ({getPitTimeSeconds(sc.id, params)}s)
                                      </option>
                                    ))}
                                  </select>
                                </td>
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

            {/* MOBILE CARDS (< md) */}
            <div className="divide-y divide-[#334155] md:hidden">
              {enrichedSchedule.map((row) => {
                const isCollapsed = Boolean(collapsedStints[row.id]);
                const nextStintLabel = `Stint ${String((row.stintNum || 0) + 1).padStart(2, '0')}`;
                return (
                  <React.Fragment key={row.id}>
                    <div className="p-4 space-y-3 bg-[#1e293b]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
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
                          <span
                            className={`inline-flex h-2.5 w-2.5 rounded-full ${row.type === 'fp'
                              ? 'bg-sky-400'
                              : row.type === 'qualy'
                                ? 'bg-[#eab308]'
                                : 'bg-[#22c55e]'
                              }`}
                          />
                          <div>
                            <span className="text-sm font-bold text-white">{row.label}</span>
                            {isCollapsed && (
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

                      {!isCollapsed && (
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
                                {DRIVERS.map((d) => (
                                  <option key={d} value={d}>
                                    {d}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {row.type === 'fp' ? (
                            <div className="rounded-md border border-[#334155] bg-[#0f172a]/60 px-3 py-2 text-xs text-slate-400">
                              Free Practice sem desgaste de pneus
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div>
                                <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase text-slate-400">
                                  <span>Pneus Início (Toque para alternar)</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (row.type === 'race') {
                                        updateRaceStint(row.stintNum, 'tiresStart', DEFAULT_FULL_TIRES);
                                      } else {
                                        updatePreSession(row.type, 'tiresStart', DEFAULT_FULL_TIRES);
                                      }
                                    }}
                                    className="inline-flex items-center rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300 transition-colors hover:border-emerald-400 hover:bg-emerald-500/20"
                                  >
                                    4 Pneus Novos
                                  </button>
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
                                        onToggle={() => {
                                          if (tireMeta?.mode === 'new') {
                                            setStartVal(tireMeta?.canKeep ? 'keep' : 'ND');
                                          } else if (tireMeta?.mode === 'keep') {
                                            setStartVal('ND');
                                          } else {
                                            setStartVal(100);
                                          }
                                        }}
                                      />
                                    );
                                  })}
                                </div>
                              </div>

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
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {!isCollapsed && row.type === 'race' && !row.isLastStint && (
                      <div className="bg-amber-500/10 px-4 py-2.5 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <Wrench className="h-3.5 w-3.5 text-[#eab308]" />
                            <span className="font-bold uppercase tracking-wider text-[#eab308]">
                              Pitstop ({row.label} → {nextStintLabel})
                            </span>
                          </div>
                          <span className="font-mono text-slate-300">
                            {formatMinutesToHHMM(row.endMin)}
                          </span>
                        </div>
                        <select
                          value={row.pitScenario}
                          onChange={(e) =>
                            updateRaceStint(row.stintNum, 'pitScenario', e.target.value)
                          }
                          className="w-full rounded-md border border-amber-500/35 bg-[#0f172a] px-2.5 py-2 text-xs text-slate-100 focus:border-[#eab308] focus:outline-none"
                        >
                          {PIT_SCENARIOS.map((sc) => (
                            <option key={sc.id} value={sc.id}>
                              {sc.label} ({getPitTimeSeconds(sc.id, params)}s)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* BOTTOM PANEL: TIRE MANAGER (BEST TO REUSE) */}
          <div className="rounded-xl border border-[#334155] bg-[#1e293b] p-4">
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
                  <div
                    key={key}
                    className="rounded-lg border border-[#334155] bg-[#0f172a]/90 p-3.5 flex flex-col justify-between"
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
                  </div>
                );
              })}
            </div>
          </div>

          {/* MOBILE CALENDAR: AT THE VERY BOTTOM */}
          <div className="lg:hidden">{calendarCard}</div>
        </section>
      </main>

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
  );
}

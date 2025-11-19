'use strict';

/**
 * Нормализатор заголовков для русских и английских CSV
 * Преобразует заголовки к единому внутреннему формату
 */

const HEADER_MAPPINGS = {
  // Основной файл калькуляции
  calculation: {
    // ID игрока
    'Номер игрока': 'Номер игрока',
    'Player ID': 'Номер игрока',
    
    // Имя игрока
    'Игрок': 'Игрок',
    'Player': 'Игрок',
    'Customer': 'Игрок',
    
    // Депозиты
    'Сумма пополнений': 'Сумма пополнений',
    'Total deposits amount': 'Сумма пополнений',
    
    // Выводы
    'Сумма вывода': 'Сумма вывода',
    'Withdrawal amount': 'Сумма вывода',
    
    // Депозиты в валюте админа (основная колонка)
    'Сумма пополнений (в валюте админа по курсу текущего дня)': 'Сумма пополнений (в валюте админа по курсу текущего дня)',
    'Deposit amount (in the administrator\'s currency at today\'s exchange rate)': 'Сумма пополнений (в валюте админа по курсу текущего дня)',
    
    // Выводы в валюте админа (основная колонка)
    'Сумма вывода (в валюте админа по курсу текущего дня)': 'Сумма вывода (в валюте админа по курсу текущего дня)',
    'Withdrawal amount (in the administrator\'s currency at today\'s exchange rate)': 'Сумма вывода (в валюте админа по курсу текущего дня)',
    
    // Альтернативные варианты без "по курсу текущего дня"
    'Сумма пополнений (в валюте админа)': 'Сумма пополнений (в валюте админа по курсу текущего дня)',
    'Сумма вывода (в валюте админа)': 'Сумма вывода (в валюте админа по курсу текущего дня)',
    
    // Количество транзакций
    'Количество пополнений': 'Количество пополнений',
    'Deposits': 'Количество пополнений',
    
    'Количество выводов': 'Количество выводов',
    'Withdrawals': 'Количество выводов',
    
    // Касса
    'Касса': 'Касса',
    'EPOS': 'Касса',
    
    // Комиссия агента
    'Комиссия агента': 'Комиссия агента',
    'Agent fee': 'Комиссия агента',
    
    // Махинации
    'Махинации с платежами': 'Махинации с платежами',
    'Payment Fraud': 'Махинации с платежами',
    
    'Махинации с платежами (в валюте админа по курсу текущего дня)': 'Махинации с платежами (в валюте админа по курсу текущего дня)',
    'Payment Fraud (in the administrator\'s currency at today\'s exchange rate)': 'Махинации с платежами (в валюте админа по курсу текущего дня)',
    
    // Комиссия агента (в валюте админа)
    'Комиссия агента(в валюте админа по курсу текущего дня)': 'Комиссия агента(в валюте админа по курсу текущего дня)',
    'Agent fee (in the administrator\'s currency at today\'s exchange rate)': 'Комиссия агента(в валюте админа по курсу текущего дня)'
  },
  
  // Prepayments файл
  prepayments: {
    // Номер ФГ
    'Номер фин. группы': 'Номер фин. группы',
    'Financial group number': 'Номер фин. группы',
    
    // Название ФГ
    'Фин. группа': 'Фин. группа',
    'Financial Group': 'Фин. группа',
    'Финансовая группа': 'Фин. группа',
    
    // Страна
    'Страна': 'Страна',
    'Country': 'Страна',
    
    // Сумма
    'Сумма пополнений (в валюте админа)': 'Сумма пополнений (в валюте админа)',
    'Total deposits (in the administrator\'s currency)': 'Сумма пополнений (в валюте админа)',
    'Сумма пополнений': 'Сумма пополнений (в валюте админа)',
    
    // Количество
    'Количество': 'Количество',
    'Number': 'Количество'
  }
};

// Маркеры языка в содержимом данных
const LANGUAGE_MARKERS = {
  ru: ['ФГ:', 'Итого'],
  en: ['FG:', 'Overall', 'Total']
};

/**
 * Определяет язык файла по заголовкам и данным
 */
function detectLanguage(headers, firstDataRow) {
  // Проверяем заголовки
  const ruHeaders = ['Номер игрока', 'Игрок', 'Касса', 'Фин. группа'];
  const enHeaders = ['Player ID', 'Customer', 'EPOS', 'Financial Group'];
  
  let ruScore = 0;
  let enScore = 0;
  
  headers.forEach(h => {
    if (ruHeaders.some(rh => h.includes(rh))) ruScore++;
    if (enHeaders.some(eh => h.includes(eh))) enScore++;
  });
  
  // Проверяем данные (первая строка, второй столбец)
  if (firstDataRow && firstDataRow[Object.keys(firstDataRow)[1]]) {
    const secondCol = String(firstDataRow[Object.keys(firstDataRow)[1]]);
    
    if (secondCol.startsWith('ФГ:') || secondCol === 'Итого') ruScore += 5;
    if (secondCol.startsWith('FG:') || secondCol === 'Overall' || secondCol === 'Total') enScore += 5;
  }
  
  console.log('[Normalizer] Language detection - RU:', ruScore, 'EN:', enScore);
  return ruScore >= enScore ? 'ru' : 'en';
}

/**
 * Нормализует заголовки к русскому формату
 */
function normalizeHeaders(data, fileType = 'calculation') {
  if (!data || data.length === 0) {
    return { normalized: data, language: 'ru' };
  }
  
  const headers = Object.keys(data[0]);
  const language = detectLanguage(headers, data[0]);
  
  console.log('[Normalizer] Detected language:', language);
  console.log('[Normalizer] Original headers:', headers);
  
  const mapping = HEADER_MAPPINGS[fileType];
  if (!mapping) {
    console.warn('[Normalizer] Unknown file type:', fileType);
    return { normalized: data, language };
  }
  
  // Создаем маппинг старых заголовков к новым
  const headerMap = {};
  headers.forEach(oldHeader => {
    const normalized = mapping[oldHeader];
    if (normalized) {
      headerMap[oldHeader] = normalized;
    } else {
      // Если заголовок не найден, оставляем как есть
      headerMap[oldHeader] = oldHeader;
      if (language === 'en') {
        console.warn('[Normalizer] Unmapped English header:', oldHeader);
      }
    }
  });
  
  console.log('[Normalizer] Header mapping:', headerMap);
  
  // Преобразуем данные
  const normalized = data.map(row => {
    const newRow = {};
    Object.keys(row).forEach(key => {
      const newKey = headerMap[key];
      newRow[newKey] = row[key];
    });
    return newRow;
  });
  
  console.log('[Normalizer] Normalized headers:', Object.keys(normalized[0]));
  
  return { normalized, language };
}

/**
 * Нормализует маркеры в данных (ФГ:, Итого)
 */
function normalizeDataMarkers(data, language) {
  if (!data || data.length === 0 || language === 'ru') {
    return data;
  }
  
  const headers = Object.keys(data[0]);
  
  return data.map(row => {
    const newRow = { ...row };
    
    // Нормализуем маркеры в первых двух колонках
    headers.slice(0, 2).forEach(key => {
      let value = String(newRow[key] || '');
      
      // FG: → ФГ:
      if (value.startsWith('FG:')) {
        value = value.replace(/^FG:/, 'ФГ:');
      }
      
      // Overall, Total → Итого
      if (value === 'Overall' || value === 'Total') {
        value = 'Итого';
      }
      
      newRow[key] = value;
    });
    
    return newRow;
  });
}

/**
 * Универсальная функция нормализации файла
 */
function normalizeFile(data, fileType = 'calculation') {
  const { normalized, language } = normalizeHeaders(data, fileType);
  const fullyNormalized = normalizeDataMarkers(normalized, language);
  
  console.log('[Normalizer] File normalized:', {
    type: fileType,
    language,
    rows: fullyNormalized.length
  });
  
  return fullyNormalized;
}

// Экспорт для Web Worker
if (typeof self !== 'undefined' && self.importScripts) {
  self.normalizeFile = normalizeFile;
  self.normalizeHeaders = normalizeHeaders;
  self.normalizeDataMarkers = normalizeDataMarkers;
  self.detectLanguage = detectLanguage;
}

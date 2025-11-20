'use strict';

/**
 * ВАЖНО: Этот модуль работает с НОРМАЛИЗОВАННЫМИ данными.
 * Все заголовки уже преобразованы к русскому формату.
 * ФГ: и Итого также уже преобразованы.
 */

function createFGSummary(groupedData, prepayData, cashierToAgent = {}) {
  console.log('[FG Summary] Создание сводки');
  console.log('[FG Summary] Маппинг получен:', Object.keys(cashierToAgent).length, 'записей');
  
  if (!groupedData || groupedData.length === 0) {
    return null;
  }
  
  const headers = Object.keys(groupedData[0]);
  const cashierKey = headers.find(h => h === 'Касса') || headers[12];
  
  // Фильтруем prepayData от строк "Итого"
  let cleanPrepayData = [];
  if (prepayData && prepayData.length > 0) {
    cleanPrepayData = prepayData.filter(row => {
      const col0 = String(row[Object.keys(row)[0]] || '').trim();
      const col1 = String(row[Object.keys(row)[1]] || '').trim();
      return col1 !== 'Итого' && col1 !== 'Overall' && col0 !== 'Итого' && col0 !== 'Overall';
    });
    console.log('[FG Summary] Prepay строк после фильтрации:', cleanPrepayData.length);
  }
  
  // ШАГ 1: Извлекаем имена ФГ из строк ФГ в данных
  const fgRows = groupedData.filter(row => row._isFG);
  
  if (fgRows.length === 0) {
    console.warn('[FG Summary] Строки ФГ не найдены');
    return null;
  }
  
  const fgGroups = {};
  
  // Собираем имена ФГ из строк ФГ
  fgRows.forEach(fgRow => {
    const col0 = String(fgRow[headers[0]] || '');
    const col1 = String(fgRow[headers[1]] || '');
    
    let fgName = '';
    
    if (col0.startsWith('ФГ:')) {
      fgName = col0.substring(3).trim();
    } else if (col1.startsWith('ФГ:')) {
      fgName = col1.substring(3).trim();
    }
    
    if (!fgName) return;
    
    if (!fgGroups[fgName]) {
      fgGroups[fgName] = {
        fgName: fgName,
        cashiers: [],
        cashierIds: new Set(),
        uniqueCashierNames: new Set(),
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalCommission: 0,
        totalProfit: 0,
        depositCounts: [],
        withdrawalCounts: [],
        deposits: [],
        withdrawals: []
      };
    }
  });
  
  console.log('[FG Summary] Найдено ФГ из строк:', Object.keys(fgGroups).length);
  
  // ШАГ 2: Агрегируем данные игроков, используя маппинг cashierToAgent
  groupedData.forEach(row => {
    if (row._isFG || row._isOverall || row._separator) return;
    
    const cashierName = String(row[cashierKey] || '').trim();
    if (!cashierName) return;
    
    const cashierId = extractCashierId(cashierName);
    
    // Ищем агента через маппинг
    const agentName = cashierToAgent[cashierId] || cashierToAgent[cashierName];
    
    if (!agentName) {
      console.warn('[FG Summary] Агент не найден для кассы:', cashierName);
      return;
    }
    
    // Проверяем, есть ли эта ФГ в нашем списке
    if (!fgGroups[agentName]) {
      console.warn('[FG Summary] ФГ не найдена в списке:', agentName);
      return;
    }
    
    const group = fgGroups[agentName];
    
    // Добавляем кассу
    if (!group.cashierIds.has(cashierId)) {
      group.cashierIds.add(cashierId);
      group.uniqueCashierNames.add(cashierName);
      group.cashiers.push(cashierName);
    }
    
    const parseNum = (val) => parseFloat(String(val).replace(/[\s,]/g, '')) || 0;
    
    // Агрегируем суммы
    const deposits = parseNum(
      row['Сумма пополнений (в валюте админа по курсу текущего дня)'] ||
      row['Сумма пополнений (в валюте админа)'] || 0
    );
    
    const withdrawals = parseNum(
      row['Сумма вывода (в валюте админа по курсу текущего дня)'] ||
      row['Сумма вывода (в валюте админа)'] || 0
    );
    
    group.totalDeposits += deposits;
    group.totalWithdrawals += withdrawals;
    
    const depCount = parseNum(row['Количество пополнений'] || 0);
    const withCount = parseNum(row['Количество выводов'] || 0);
    
    if (depCount > 0) group.depositCounts.push(depCount);
    if (withCount > 0) group.withdrawalCounts.push(withCount);
    
    group.totalCommission += parseNum(row['Комиссия'] || 0);
    group.totalProfit += parseNum(row['Профит'] || 0);
    
    const avgDep = parseNum(row['Средний депозит'] || 0);
    const avgWith = parseNum(row['Средний вывод'] || 0);
    
    if (avgDep > 0) group.deposits.push(avgDep);
    if (avgWith > 0) group.withdrawals.push(avgWith);
  });
  
  // Формируем итоговую сводку
  const summary = [];
  
  Object.values(fgGroups).forEach(group => {
    let prepaidAmount = 0;
    
    if (cleanPrepayData.length > 0) {
      const prepayRow = cleanPrepayData.find(p => {
        // Используем нормализованные заголовки
        const prepayFG = String(p['Фин. группа'] || p['Финансовая группа'] || '').trim();
        return prepayFG.toLowerCase() === group.fgName.toLowerCase() ||
               prepayFG.toLowerCase().includes(group.fgName.toLowerCase()) ||
               group.fgName.toLowerCase().includes(prepayFG.toLowerCase());
      });
      
      if (prepayRow) {
        prepaidAmount = parseFloat(
          String(prepayRow['Сумма пополнений (в валюте админа)'] || 
                 prepayRow['Сумма пополнений'] || 0).replace(/[\s,]/g, '')
        ) || 0;
        
        console.log('[FG Summary] Найден prepay для', group.fgName, '=', prepaidAmount);
      } else {
        console.log('[FG Summary] Prepay НЕ найден для', group.fgName);
      }
    }
    
    const playerCount = countPlayersForCashiers(groupedData, Array.from(group.cashierIds), cashierKey);
    
    const depositToWithdrawalPercent = group.totalWithdrawals > 0 ?
      (group.totalDeposits / group.totalWithdrawals * 100) : 0;
    
    const coveragePercent = group.totalDeposits > 0 ?
      (prepaidAmount / group.totalDeposits * 100) : 0;
    
    const avgDeposit = group.deposits.length > 0 ?
      group.deposits.reduce((a, b) => a + b, 0) / group.deposits.length : 0;
    
    const avgWithdrawal = group.withdrawals.length > 0 ?
      group.withdrawals.reduce((a, b) => a + b, 0) / group.withdrawals.length : 0;
    
    const exportString = `${Array.from(group.cashierIds)[0] || ''},${round2(group.totalDeposits)},${round2(prepaidAmount)},${playerCount}`;
    
    summary.push({
      'ФГ': group.fgName,
      'Кассы': group.cashiers.join(', '),
      'Деп. $': round2(group.totalDeposits),
      'Преп. $': round2(prepaidAmount),
      'Игроки': playerCount,
      'Выв. $': round2(group.totalWithdrawals),
      'Профит ($)': round2(group.totalProfit),
      'Ввод/вывод %': round2(depositToWithdrawalPercent),
      'Деп/преп %': round2(coveragePercent),
      'Комиссия $': round2(group.totalCommission),
      'Ср. деп. $': round2(avgDeposit),
      'Ср. выв.($)': round2(avgWithdrawal),
      'Кол-во касс': group.cashierIds.size,
      'Export': exportString
    });
  });
  
  console.log('[FG Summary] Создано строк:', summary.length);
  return summary;
}

function countPlayersForCashiers(data, cashierIds, cashierKey) {
  let count = 0;
  
  data.forEach(row => {
    if (row._isFG || row._isOverall || row._separator) return;
    
    const rowCashier = String(row[cashierKey] || '');
    const rowCashierId = extractCashierId(rowCashier);
    
    if (cashierIds.includes(rowCashierId) || cashierIds.includes(rowCashier)) {
      count++;
    }
  });
  
  return count;
}

function extractCashierId(cashierStr) {
  const match = String(cashierStr).match(/(\d+)[,\s]/);
  return match ? match[1] : cashierStr;
}

function round2(num) {
  return Math.round(num * 100) / 100;
}

if (typeof self !== 'undefined' && self.importScripts) {
  self.createFGSummary = createFGSummary;
}

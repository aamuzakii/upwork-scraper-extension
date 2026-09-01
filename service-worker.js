// TODO:
// currently we do querySelector('[data-test="JobInfo"]') then normalizeFee
// i suspect we can do more granule query instead of query data-test="JobInfo", so no need to normalizedFee anymore

const USER_DASHBOARD_URL = 'https://home-dashboard-lac.vercel.app/api/user';
const OBLIGATION_REFRESH_ALARM = 'refresh-obligation-time';

function formatRemainingTime(minutes) {
  const wholeMinutes = Math.round(minutes);
  const sign = wholeMinutes < 0 ? '-' : '';
  const absoluteMinutes = Math.abs(wholeMinutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const mins = absoluteMinutes % 60;
  return `${sign}${hours}:${String(mins).padStart(2, '0')}`;
}

function formatRemainingTimeBadge(minutes) {
  const roundedMinutes = Math.round(minutes);
  const sign = roundedMinutes < 0 ? '-' : '';
  const absoluteMinutes = Math.abs(roundedMinutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const mins = absoluteMinutes % 60;

  return hours > 0 ? `${sign}${hours}h` : `${sign}${mins}m`;
}

function drawRemainingTimeIcon(remainingMinutes, weeklyMinutes) {
  const size = 38;
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext('2d');
  const cardHeight = 16;
  const borderPadding = 1.8;
  const trackWidth = size - borderPadding * 2;
  const trackHeight = cardHeight - borderPadding * 2;
  const usableWidth = trackWidth - borderPadding * 2;
  const remaining = Math.max(0, remainingMinutes);
  const total = Math.max(0, weeklyMinutes);
  const progress = total === 0 ? 0 : Math.min(1, remaining / total);
  const barColor = remainingMinutes <= 0 ? '#f20031' : remaining <= 60 ? '#f59e0b' : '#16a34a';
  const barWidth = Math.max(4, usableWidth * progress);

  // This compact card mirrors the reference extension's toolbar treatment.
  context.fillStyle = 'whitesmoke';
  context.fillRect(0, 0, size, cardHeight);

  context.fillStyle = '#2e3338';
  context.fillRect(borderPadding, borderPadding, trackWidth, trackHeight);

  context.fillStyle = barColor;
  context.fillRect(borderPadding * 2, borderPadding * 2, barWidth, trackHeight - borderPadding * 2);

  context.fillStyle = 'whitesmoke';
  context.font = 'bold 12px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(formatRemainingTime(remainingMinutes), size / 2, cardHeight / 2 + 0.5);

  return context.getImageData(0, 0, size, size);
}

async function updateObligationTimeIcon() {
  try {
    console.info('[Obligation timer] Fetching dashboard data:', USER_DASHBOARD_URL);
    const response = await fetch(USER_DASHBOARD_URL, { cache: 'no-store' });
    console.info('[Obligation timer] Response received:', response.status, response.statusText);
    if (!response.ok) {
      throw new Error(`Dashboard request failed with ${response.status}`);
    }

    const responseBody = await response.text();
    console.info('[Obligation timer] Raw response body:', responseBody);
    const { name, weeklyMinutes, obligationMinutes } = JSON.parse(responseBody);
    console.info('[Obligation timer] Parsed dashboard values:', {
      name,
      weeklyMinutes,
      obligationMinutes,
      weeklyMinutesType: typeof weeklyMinutes,
      obligationMinutesType: typeof obligationMinutes,
    });
    if (!Number.isFinite(weeklyMinutes) || !Number.isFinite(obligationMinutes)) {
      throw new Error('Dashboard returned invalid time values');
    }

    const remainingMinutes = weeklyMinutes - obligationMinutes;
    const timeLabel = formatRemainingTime(remainingMinutes);
    const badgeText = formatRemainingTimeBadge(remainingMinutes);
    const badgeColor = remainingMinutes <= 0 ? '#f20031' : remainingMinutes <= 60 ? '#f59e0b' : '#16a34a';
    console.info('[Obligation timer] Remaining time calculated:', {
      calculation: `${weeklyMinutes} - ${obligationMinutes}`,
      remainingMinutes,
      timeLabel,
      badgeText,
    });
    await chrome.action.setIcon({
      imageData: { 38: drawRemainingTimeIcon(remainingMinutes, weeklyMinutes) },
    });
    await chrome.action.setBadgeText({ text: badgeText });
    await chrome.action.setBadgeBackgroundColor({ color: badgeColor });
    await chrome.action.setTitle({
      title: `${name || 'Work'}: ${timeLabel} remaining (${remainingMinutes} minutes)`,
    });
  } catch (error) {
    console.error('[Obligation timer] Unable to update remaining obligation time:', error);
    await chrome.action.setBadgeText({ text: '!' });
    await chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
    await chrome.action.setTitle({ title: 'Unable to load remaining work time' });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(OBLIGATION_REFRESH_ALARM, { periodInMinutes: 1 });
  updateObligationTimeIcon();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(OBLIGATION_REFRESH_ALARM, { periodInMinutes: 1 });
  updateObligationTimeIcon();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === OBLIGATION_REFRESH_ALARM) {
    updateObligationTimeIcon();
  }
});

updateObligationTimeIcon();


function extractFromHomePage(os) {
  function normalizeFee(fee = '') {
    const result = {
      paymentType: null,
      minRate: null,
      maxRate: null,
      fixedBudget: null,
      experienceLevel: null,
      duration: null,
      weeklyHours: null,
      otherInfo: null,
    };

    let remaining = fee;

    if (/^Hourly:/i.test(remaining)) {
      result.paymentType = 'HOURLY';
      remaining = remaining.replace(/^Hourly:\s*/i, '');
    } else if (/^Fixed price/i.test(remaining)) {
      result.paymentType = 'FIXED_PRICE';
      remaining = remaining.replace(/^Fixed price\s*/i, '');
    }

    const hourlyMatch = remaining.match(/\$(\d+(?:\.\d+)?)\s*-\s*\$(\d+(?:\.\d+)?)/);
    if (hourlyMatch) {
      result.minRate = Math.round(Number(hourlyMatch[1]));
      result.maxRate = Math.round(Number(hourlyMatch[2]));
      remaining = remaining.replace(hourlyMatch[0], '');
    }

    const fixedMatch = remaining.match(/Est\. budget:\s*\$(\d+(?:\.\d+)?)/i);
    if (fixedMatch) {
      result.fixedBudget = Math.round(Number(fixedMatch[1]));
      remaining = remaining.replace(fixedMatch[0], '');
    }

    const expMatch = remaining.match(/\b(Entry Level|Intermediate|Expert)\b/i);
    if (expMatch) {
      result.experienceLevel = {
        'Entry Level': 'ENTRY_LEVEL',
        Intermediate: 'INTERMEDIATE',
        Expert: 'EXPERT',
      }[expMatch[1]];
      remaining = remaining.replace(expMatch[0], '');
    }

    const durationMatch = remaining.match(/Less than 1 month|1 to 3 months|3 to 6 months|More than 6 months/i);
    if (durationMatch) {
      result.duration = durationMatch[0];
      remaining = remaining.replace(durationMatch[0], '');
    }

    const weeklyMatch = remaining.match(/Less than 30 hrs\/week|30\+ hrs\/week|Not sure/i);
    if (weeklyMatch) {
      result.weeklyHours = weeklyMatch[0];
      remaining = remaining.replace(weeklyMatch[0], '');
    }

    remaining = remaining
      .replace(/Est\. time:/gi, '')
      .replace(/,+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (remaining) result.otherInfo = remaining;

    return result;
  }
  const jobTileListElement = document.querySelector(
    '[data-test="job-tile-list"]'
  );
  const arrOfJobs = [];
  Array.from(jobTileListElement.children).forEach((section, i) => {
    // date
    const date =
      section.querySelector('[data-test="job-pubilshed-date"] span')?.textContent
        .replace(/^Posted\s+/i, '')
        .trim() ?? '';
    // title & link
    const titleLink =
      section.querySelector('a[data-test*="job-tile-title-link"]') ||
      section.querySelector('h2 a') ||
      section.querySelector('a[href*="/jobs/"]');

    console.log('titleLink', titleLink);

    const title = titleLink?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

    const href = titleLink?.href || titleLink?.getAttribute('href') || '';
    const link = href
      ? new URL(href, location.origin).href.split('?')[0]
      : '';
    // description
    const desc =
      section
        .querySelector('[data-test="UpCLineClamp JobDescription"] p')
        ?.textContent.replace(/\s+/g, ' ').trim() ?? '';
    // skills
    const skillCollection = Array.from(
      section.querySelectorAll('[data-test="token"]')
    ).map((el) => el.textContent.trim());
    // proposals
    const applier =
      section
        .querySelector('[data-test="proposals-tier"]')
        ?.textContent.replace(/^Proposals:\s*/i, '').trim() ?? 'no proposal yet';
    // country
    const country =
      section
        .querySelector('[data-test="location"] .rr-mask')
        ?.textContent.replace(/^Location\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim() ?? '';
    // fee
    const fee =
      section
        .querySelector('[data-test="JobInfo"]')
        ?.textContent.replace(/\s+/g, ' ').trim() ?? '';
    const normalizedFee = normalizeFee(fee);
    const newData = {
      url: link,
      title,
      stack: JSON.stringify(skillCollection),
      country,
      candidates: applier,
      description: desc,
      date,
      ...normalizedFee,
    };
    arrOfJobs.push(newData);
  });
  fetch("https://upworkui-aamuzakiis-projects.vercel.app/api/store", {
    method: "POST",
    // headers: {
    //   "Content-Type": "application/json",
    // },
    body: JSON.stringify(arrOfJobs),
  });
}

function extractFromSearchPage(os) {
  function normalizeFee(fee = '') {
    const result = {
      paymentType: null,
      minRate: null,
      maxRate: null,
      fixedBudget: null,
      experienceLevel: null,
      duration: null,
      weeklyHours: null,
      otherInfo: null,
    };

    let remaining = fee;

    if (/^Hourly:/i.test(remaining)) {
      result.paymentType = 'HOURLY';
      remaining = remaining.replace(/^Hourly:\s*/i, '');
    } else if (/^Fixed price/i.test(remaining)) {
      result.paymentType = 'FIXED_PRICE';
      remaining = remaining.replace(/^Fixed price\s*/i, '');
    }

    const hourlyMatch = remaining.match(/\$(\d+(?:\.\d+)?)\s*-\s*\$(\d+(?:\.\d+)?)/);
    if (hourlyMatch) {
      result.minRate = Math.round(Number(hourlyMatch[1]));
      result.maxRate = Math.round(Number(hourlyMatch[2]));
      remaining = remaining.replace(hourlyMatch[0], '');
    }

    const fixedMatch = remaining.match(/Est\. budget:\s*\$(\d+(?:\.\d+)?)/i);
    if (fixedMatch) {
      result.fixedBudget = Math.round(Number(fixedMatch[1]));
      remaining = remaining.replace(fixedMatch[0], '');
    }

    const expMatch = remaining.match(/\b(Entry Level|Intermediate|Expert)\b/i);
    if (expMatch) {
      result.experienceLevel = {
        'Entry Level': 'ENTRY_LEVEL',
        Intermediate: 'INTERMEDIATE',
        Expert: 'EXPERT',
      }[expMatch[1]];
      remaining = remaining.replace(expMatch[0], '');
    }

    const durationMatch = remaining.match(/Less than 1 month|1 to 3 months|3 to 6 months|More than 6 months/i);
    if (durationMatch) {
      result.duration = durationMatch[0];
      remaining = remaining.replace(durationMatch[0], '');
    }

    const weeklyMatch = remaining.match(/Less than 30 hrs\/week|30\+ hrs\/week|Not sure/i);
    if (weeklyMatch) {
      result.weeklyHours = weeklyMatch[0];
      remaining = remaining.replace(weeklyMatch[0], '');
    }

    remaining = remaining
      .replace(/Est\. time:/gi, '')
      .replace(/,+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (remaining) result.otherInfo = remaining;

    return result;
  }
  let jobTileListElement =
    document.querySelector('[data-test="job-tile-list"]') ??
    document.querySelector('[data-test="JobsList"]');

  const arrOfJobs = [];

  Array.from(jobTileListElement.children).forEach((section, i) => {
    const date =
      section
        .querySelector('[data-test="job-pubilshed-date"] span')
        ?.textContent.replace(/^Posted\s+/i, '')
        .trim() ?? '';

    const titleLink =
      section.querySelector('a[data-test*="job-tile-title-link"]') ||
      section.querySelector('h2 a') ||
      section.querySelector('a[href*="/jobs/"]');

    console.log('titleLink', titleLink);

    const title = titleLink?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

    const href = titleLink?.href || titleLink?.getAttribute('href') || '';
    const link = href
      ? new URL(href, location.origin).href.split('?')[0]
      : '';

    const desc =
      section
        .querySelector('[data-test="UpCLineClamp JobDescription"] p')
        ?.textContent.replace(/\s+/g, ' ')
        .trim() ?? '';

    const skillCollection = Array.from(
      section.querySelectorAll('[data-test="token"]')
    ).map((el) => el.textContent.trim());

    const applier =
      section
        .querySelector('[data-test="proposals-tier"]')
        ?.textContent.replace(/^Proposals:\s*/i, '')
        .trim() ?? 'no proposal yet';

    const country =
      section
        .querySelector('[data-test="location"] .rr-mask')
        ?.textContent.replace(/^Location\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim() ?? '';

    const fee =
      section
        .querySelector('[data-test="JobInfo"]')
        ?.textContent.replace(/\s+/g, ' ')
        .trim() ?? '';
    const normalizedFee = normalizeFee(fee);
    const newData = {
      url: link,
      title,
      stack: JSON.stringify(skillCollection),
      country,
      candidates: applier,
      description: desc,
      date,
      ...normalizedFee,
    };

    console.log(newData, "data");
    arrOfJobs.push(newData);
  });

  fetch("https://upworkui-aamuzakiis-projects.vercel.app/api/store", {
    method: "POST",
    // headers: {
    //   "Content-Type": "application/json",
    // },
    body: JSON.stringify(arrOfJobs),
  });
}

chrome.action.onClicked.addListener((tab) => {
  chrome.runtime.getPlatformInfo().then((x) => {
    let extractor;

    switch (true) {
      case tab.url.includes('upwork.com') && tab.url.includes('find-work'):
        extractor = extractFromHomePage;
        break;

      case tab.url.includes('upwork.com'):
        extractor = extractFromSearchPage;
        break;

      case tab.url.includes('olx.co.id'):
        extractor = extractFromOlx;
        break;

      default:
        console.log('Unsupported website');
        return;
    }

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: extractor,
      args: [x.os],
    });
  });
});


// chrome.action.onClicked.addEventListener('click', async () => {
//   const currentTab = await chrome.tabs.query({ active: true });
//   const leftTabIndex = currentTab[0].index - 1;

//   if (leftTabIndex >= 0) {
//     chrome.tabs.update(leftTabIndex, { active: true });
//   } else {
//   }
// });

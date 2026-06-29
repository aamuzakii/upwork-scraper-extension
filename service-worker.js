function extractFromHomePage(os) {
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
    const newData = {
      url: link,
      title,
      stack: JSON.stringify(skillCollection),
      country,
      candidates: applier,
      description: desc,
      date,
      fee,
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

    const newData = {
      url: link,
      title,
      stack: JSON.stringify(skillCollection),
      country,
      candidates: applier,
      description: desc,
      date,
      fee,
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
      if (tab.url.includes("find-work")) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: extractFromHomePage,
      args: [x.os],
    });
  } else {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: extractFromSearchPage,
      args: [x.os],
    });
  }
  })
});


// chrome.action.onClicked.addEventListener('click', async () => {
//   const currentTab = await chrome.tabs.query({ active: true });
//   const leftTabIndex = currentTab[0].index - 1;

//   if (leftTabIndex >= 0) {
//     chrome.tabs.update(leftTabIndex, { active: true });
//   } else {
//   }
// });
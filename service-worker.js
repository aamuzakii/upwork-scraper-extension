function extractFromHomePage(os) {
  console.log(os);
  const jobTileListElement = document.querySelector(
    '[data-test="job-tile-list"]'
  );

  const arrOfJobs = [];

  Array.from(jobTileListElement.children).forEach((section, i) => {

    // one section consist of header & content

    const header = section.children[0]
    const content = section.children[1];
    const constant = 1
    const meaningfulHeader = header.children[1]
    const x = meaningfulHeader.children[0]

    
    const dateElement = section.querySelector(
      '[data-test="posted-on"]'
    )
    
    const date = dateElement.innerHTML.trim()

    console.log(date);


    // const date =
    //   meaningfulHeader.children[0+constant].children[0].innerHTML.replace(
    //     /\s+/g,
    //     " "
    //   );

    // const titleElementD = meaningfulHeader.children[1+constant]
    const titleElement = dateElement.parentElement.parentElement.children[1]

    const title =
      titleElement.textContent.replace(
        /\s+/g,
        " "
      );


    const link = titleElement.children[0].href
      .replace(/\s+/g, " ")
      .split("?")[0];


    const desc =
      content.children[1].children[0].children[0].children[0].textContent.replace(
        /\s+/g,
        " "
      );
    const fofo = content.children[2].children;

    const skillParent = fofo[0].children[0].children[2];

    const skill = skillParent ? skillParent.children : [];

    const skillCollection = [];

    Array.from(skill).forEach((element) => {
      skillCollection.push(element.textContent);
    });

    const applier = section.querySelector(
      '[data-test="proposals"]'
    ).textContent;

    const locationPar = section.querySelector('[data-test="client-country"]');

    const location = locationPar ? locationPar.textContent : "";    
    country = location.trim().replace(/\s+/g, ' ')

    // https://www.upwork.com/nx/find-work/most-recent
    const fee = section.querySelector(
      ".text-light.display-inline-block.text-caption"
    ).textContent;

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

    console.log(newData);

    arrOfJobs.push(newData);
  });

  console.log("fetching...");
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
    const date = section
      .querySelector('[data-test="JobTileHeader"]')
      .children[0].children[1].textContent.replace(/\s+/g, " ");

    const title = section
      .querySelector('[data-test="UpCLineClamp"]')
      .textContent.replace(/\s+/g, " ");

    const link = section.querySelector('[data-test="UpCLineClamp"]').children[0]
      .children[0].children[0].href;

    const desc = section
      .querySelector('[data-test="UpCLineClamp JobDescription"]')
      .textContent.replace(/\s+/g, " ");

    const content = section.children[2];

    // const fee = content.children[0];

    const stacks =
      section.querySelector('[data-test="TokenClamp JobAttrs"]') || [];

    const skillCollection = [];

    stacks.children = stacks.children ?? [];

    Array.from(stacks.children).forEach((element) => {
      skillCollection.push(element.textContent);
    });

    const applier = section.querySelector('[data-test="proposals-tier"]')
      .children[1].textContent;

    const locationPar = section.querySelector('[data-test="location"]');

    const location = locationPar ? locationPar.textContent : "";

    let country = location.replace(/\s/g, "");

    const fee = section.querySelector(
      '[data-test="JobInfo"]'
    ).textContent;

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

  console.log("fetching...");
  fetch("https://upworkui-aamuzakiis-projects.vercel.app/api/store", {
    method: "POST",
    // headers: {
    //   "Content-Type": "application/json",
    // },
    body: JSON.stringify(arrOfJobs),
  });
}

chrome.action.onClicked.addListener((tab) => {
  console.log("init extension");
  console.log(chrome.runtime.getPlatformInfo());

  chrome.runtime.getPlatformInfo().then((x) => {
    console.log(x.os);
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
//   console.log(123);
//   const currentTab = await chrome.tabs.query({ active: true });
//   const leftTabIndex = currentTab[0].index - 1;

//   if (leftTabIndex >= 0) {
//     chrome.tabs.update(leftTabIndex, { active: true });
//   } else {
//     console.log("No tabs to the left");
//   }
// });
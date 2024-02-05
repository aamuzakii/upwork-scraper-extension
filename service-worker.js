function reddenPage() {
  const jobTileListElement = document.querySelector(
    '[data-test="job-tile-list"]'
  );

  const arrOfJobs = [];

  Array.from(jobTileListElement.children).forEach((section, i) => {
    console.info(i);
    const date =
      section.children[0].children[1].children[0].children[0].innerHTML.replace(
        /\s+/g,
        " "
      );

    const title =
      section.children[0].children[1].children[1].textContent.replace(
        /\s+/g,
        " "
      );

    console.info(title);

    const link = section.children[0].children[1].children[1].children[0].href
      .replace(/\s+/g, " ")
      .split("?")[0];

    const content = section.children[1];

    const fee = content.children[0];
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

    let country = location.replace(/\s/g, "");

    const newData = {
      url: link,
      title,
      stack: JSON.stringify(skillCollection),
      country,
      candidates: applier,
      description: desc,
      date,
    };

    arrOfJobs.push(newData);
  });

  fetch("http://localhost:3000/store", {
    method: "POST",
    // headers: {
    //   "Content-Type": "application/json",
    // },
    body: JSON.stringify(arrOfJobs),
  });
}

function searchUtil() {
  let jobTileListElement =
    document.querySelector('[data-test="job-tile-list"]') ??
    document.querySelector('[data-test="JobsList"]');

  const arrOfJobs = [];

  Array.from(jobTileListElement.children).forEach((section, i) => {
    console.info(i);
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

    Array.from(stacks).forEach((element) => {
      skillCollection.push(element.textContent);
    });

    const applier = section.querySelector('[data-test="proposals-tier"]')
      .children[1].textContent;

    const locationPar = section.querySelector('[data-test="location"]');

    const location = locationPar ? locationPar.textContent : "";

    let country = location.replace(/\s/g, "");

    const newData = {
      url: link,
      title,
      stack: JSON.stringify(skillCollection),
      country,
      candidates: applier,
      description: desc,
      date,
    };

    arrOfJobs.push(newData);
  });

  fetch("http://localhost:3000/store", {
    method: "POST",
    // headers: {
    //   "Content-Type": "application/json",
    // },
    body: JSON.stringify(arrOfJobs),
  });
}

chrome.action.onClicked.addListener((tab) => {
  if (tab.url.includes("find-work")) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: reddenPage,
    });
  } else {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: searchUtil,
    });
  }
});

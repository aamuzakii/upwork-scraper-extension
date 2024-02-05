function reddenPage() {
  const jobTileListElement = document.querySelector(
    '[data-test="job-tile-list"]'
  );

  const arrOfJobs = [];

  Array.from(jobTileListElement.children).forEach((section, i) => {
    console.log("init", i);
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

    const skill = fofo[0].children[0].children[2].children;

    const skillCollection = [];

    Array.from(skill).forEach((element) => {
      skillCollection.push(element.textContent);
    });

    const applier = content.children[4].children[0].children[1].innerHTML;

    let countryPar = content.children[3].children[3];
    country = countryPar ? countryPar.textContent : "";

    country = country.replace(/\s/g, "");

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

  console.log(arrOfJobs);
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
    console.log("init", i);
    const date =
      section.children[1].children[1].children[0].children[0].innerHTML.replace(
        /\s+/g,
        " "
      );

    const title =
      section.children[1].children[1].children[1].textContent.replace(
        /\s+/g,
        " "
      );

    const link = section.children[1].children[1].children[1].children[0].href
      .replace(/\s+/g, " ")
      .split("?")[0];

    const content = section.children[2];

    const fee = content.children[0];
    const desc =
      content.children[1].children[0].children[0].children[0].textContent.replace(
        /\s+/g,
        " "
      );

    console.log(1);
    const fofo = content.children[2].children;

    const skill = fofo[0].children[0].children[2].children;

    const skillCollection = [];

    Array.from(skill).forEach((element) => {
      skillCollection.push(element.textContent);
    });
    console.log(2);

    const applier = content.children[4].children[0].children[1].innerHTML;

    let countryPar = content.children[3].children[3];
    country = countryPar ? countryPar.textContent : "";
    console.log(3);

    country = country.replace(/\s/g, "");

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

  console.log(arrOfJobs);
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

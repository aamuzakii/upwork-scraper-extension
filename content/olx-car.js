function isCarPage() {
  return location.pathname.includes("mobil");
}

if (isCarPage()) {
  alert("Detected OLX car page");
}
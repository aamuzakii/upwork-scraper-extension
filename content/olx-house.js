function isHousePage() {
  return location.pathname.includes("rumah");
}

if (!isHousePage()) {
  throw new Error("Not a house page");
}
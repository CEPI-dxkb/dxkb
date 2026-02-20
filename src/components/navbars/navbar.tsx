import MobileNavbar from "./mobile-navbar";
import DesktopNavbar from "./desktop-navbar";

const Navbar = () => {
  return (
    <div id="navbar-container">
      <DesktopNavbar />
      <MobileNavbar />
    </div>
  );
};

export default Navbar;
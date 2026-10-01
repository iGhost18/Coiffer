import './footer.css'
import LocationPinIcon from '@mui/icons-material/LocationPin';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import CopyrightIcon from '@mui/icons-material/Copyright';
import { FaYoutube } from "react-icons/fa";
import { FaInstagram } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { AiFillTikTok } from "react-icons/ai";
import { FaSnapchat } from "react-icons/fa6";

export default function Footer() {
  return (
    <>
        <div className="Footer">
            <div className="FooterTop">

                <div className="FooterRight">
                <img src="/assets/GhostLogo.png" alt="" />
                <h5>
                    Premium grooming services in a modern, comfortable environment. We provide the best haircuts, styling, skin care, <br /> and full-body grooming services.
                </h5>

                <FaYoutube  className='icons'/>
                <AiFillTikTok className='icons' />
                <FaInstagram className='icons' />
                <FaXTwitter className='icons' />
                <FaSnapchat  className='icons'/>

                </div>
                <div className="FooterLeft">
                <ul className='QuickLinks'>
                    <h3 className='Header'>Quick Links</h3>
                    <li>About us</li>
                </ul>
                <div className="Information">
                    <h3>Information</h3>
                    <div className="InfoList">
                    <LocationPinIcon />
                    <h6>Nigeria</h6>
                    </div>
                    <div className="InfoList">
                    <EmailIcon/>
                    <h6>Ghosthebarber@gmail.com</h6>
                    </div>
                    <div className="InfoList">
                    <PhoneIcon/>
                    <h6>+234 813 385 5524</h6>
                    </div>
                </div>
                </div>
            </div>
            <hr />
            <div className="FooterBottom">
                <span> <CopyrightIcon/>2026 Ghosthebarber. All right reserved.</span>
                <div className='FooterBottomB'>
                <b>Privacy Policy</b>
                <b>Terms of service</b>
                </div>
            </div>
        </div>
    </>
  )
}

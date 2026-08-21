import './home.css';
import Topbar from '../../components/topbar/Topbar';
import Footer from '../../components/footer/Footer';
import VerifiedIcon from '@mui/icons-material/Verified';
import ContentCutTwoToneIcon from '@mui/icons-material/ContentCutTwoTone';
import AccessTimeFilledIcon from '@mui/icons-material/AccessTimeFilled';
import DateRangeIcon from '@mui/icons-material/DateRange';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';
import 'swiper/css';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';
import socket from "../../socket";
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import { Link } from 'react-router-dom';
import StaffSnapMap from "../../components/map/Staffsnapmap";







function Home() {
  const [homepageServices, setHomepageServices] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchHomepageServices = async () => {
      try {
        const res = await axios.get("/api/homepage-services");

        if (Array.isArray(res.data)) {
          setHomepageServices(res.data);
        } else {
          console.error("Invalid homepage-services response:", res.data);
          setHomepageServices([]);
        }
      } catch (err) {
        console.log(err);
      }
    };
    fetchHomepageServices();
  }, []);


  useEffect(() => {
    const handleServiceUpdate = ({ action, service }) => {
      setHomepageServices((prev) => {
        if (action === "add") return [service, ...prev];
        if (action === "update") return prev.map((s) => (s._id === service._id ? service : s));
        if (action === "delete") return prev.filter((s) => s._id !== service._id);
        return prev;
      });
    };

    socket.on("homepageServiceUpdate", handleServiceUpdate);

    return () => {
      socket.off("homepageServiceUpdate", handleServiceUpdate);
    };
  }, []);
  
  return (
    <div className='Home'>
      <Topbar />

      <div className='HomeContentTop'>
        <img src="/assets/MainPagePic.png" alt=""  className='HomeImg'/>

        <div className="HomeContentTopText">
          <p>
            A great haircut is more than just a style it's a symbol that defines us. Haircutting is an art that expresses freedom, it's more than just trimming hair-it's a form of self-expression, creativity, and innovation.
          </p>
          <p>
            We believe in the power of a great haircut to boost confidence and showcase your personality. That's why we offer classic cuts, modern styles, and premium grooming services tailored to your unique look. Our passion for delivering exceptional service drives us to stay ahead of the latest trends and techniques while honoring the timeless traditions that have defined barbering for generations.
          </p>
          <p>
            Our experienced barbers take the time to listen to your needs, provide expert advice, and deliver a personalized grooming experience that exceeds expectations. By combining precision, creativity, and passion, we craft styles that not only look great but also make you feel confident and comfortable.
          </p>
        </div>
      </div>

      <div className="HomeContentCenter">
        <div className="Map">
          <StaffSnapMap showBackButton={false} />
        </div>

        <div className="Choose">
          <h1>Why Choose Us?</h1>
          <p className='ChooseLine'>_____</p>
          <p>
            We combine traditional barbering techniques with modern styles to give you the perfect look.
          </p>

          <div className='ChooseGrid'>
            <h5 className='ChooseGridCard'> 
              <span className='ChooseGridIcon'>
                <VerifiedIcon/>
              </span>
              <span className='ChooseGridText'> Skilled Barbers </span>  Our team of   skilled barbers is dedicated to providing you with the best grooming experience. With years of experience and a passion for their craft, they stay up-to-date with the latest trends and techniques to ensure you have a looking and feeling your best.
            </h5>
            <h5 className='ChooseGridCard'>
              <span className='ChooseGridIcon'>
                <ContentCutTwoToneIcon/>
              </span> 
              <span className='ChooseGridText'> Premiun Service </span> We understand that  every client is unique, which is why we take the time to listen to your needs and preferences. From classic cuts to modern styles, we offer a full range of premium services.
            </h5>
            <h5 className='ChooseGridCard'>
              <span className="ChooseGridIcon">
                <AccessTimeFilledIcon/>
              </span>
              <span className='ChooseGridText'> Convenient Hours </span> We are open extended hours to accommodate your busy schedule. Open 7 days a week with early and late appointments available.
            </h5>
            <h5 className='ChooseGridCard'>
              <span className="ChooseGridIcon">
                <DateRangeIcon/>
              </span>
              <span className='ChooseGridText'>Easy Booking</span> Our user-friendly online booking system makes it easy to schedule your appointment at your convenience. With just a few clicks, you can secure your spot and look forward to a great grooming experience.
            </h5>
          </div>
        </div>
      </div>
      <div className="HomeBottom">
        <div className="Service">
          <h3>Our Services</h3>
          <div className="ServicesCard">
            {homepageServices.length === 0 ? (
              <p style={{ textAlign: "center", opacity: 0.6 }}>No services yet.</p>
            ) : (
              <Swiper
                modules={[Pagination]}
                pagination={{ clickable: true }}
                spaceBetween={30}
                slidesPerView={3.4}
                loop={homepageServices.length > 4}
              >
                {homepageServices.map((service) => (
                  <SwiperSlide key={service._id}>
                    <Link to="/friends" style={{ textDecoration: "none", color: "inherit" }}>
                      <div className="Card">
                        <span className="Picture">
                          <h6>Select</h6>
                          <img src={service.img} alt={service.name} />
                        </span>
                        <h5>
                          <span>{service.name}</span>
                          {service.desc}
                        </h5>
                      </div>
                    </Link>
                  </SwiperSlide>
                ))}
              </Swiper>
            )}
          </div>
        </div>

        <div className="HomeBottomText">
          <h3>Ready for Your Next Great Look?</h3>
          <h6>Book your appointment today and experience the premium barbering 
            service that keeps our clients coming back.
          </h6>
          <button onClick={() => navigate("/friends")}>Book An Appointment </button>
        </div>
      </div>
      <Footer />
    </div>
  )
}

export default Home

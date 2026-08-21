import "./postmodal.css";
import Post from "./Post";

import { Swiper, SwiperSlide } from "swiper/react";
import { Mousewheel, Keyboard } from "swiper/modules";

import "swiper/css";
import "swiper/css/mousewheel";

export default function PostModal({
    posts,
    selectedIndex,
    setSelectedIndex,
    onClose,
}) {

    return (
        <div className="PostModalOverlay">
            <button className="CloseBtn" onClick={onClose}>
                ×
            </button>

            <Swiper
                direction="vertical"
                slidesPerView={1}
                initialSlide={selectedIndex}
                mousewheel
                keyboard
                speed={500}
                modules={[Mousewheel, Keyboard]}
                className="PostModalSwiper"
                onSlideChange={(swiper) =>
                    setSelectedIndex(swiper.activeIndex)
                }
            >
                {posts.map((post) => (
                    <SwiperSlide key={post._id}>
                        <div className="PostModalSlide">
                            <Post post={post} />
                        </div>
                    </SwiperSlide>
                ))}
            </Swiper>
        </div>
    );
}
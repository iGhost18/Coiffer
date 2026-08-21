const axios = require("axios");

const geocodeAddress = async (address) => {
  try {
    const response = await axios.get(
      "https://nominatim.openstreetmap.org/search",
      {
        params: {
          q: address,
          format: "json",
          limit: 1,
        },
        headers: {
          "User-Agent": "GhostCutApp/1.0",
        },
      }
    );

    if (!response.data.length) {
      return null;
    }

    return {
      lat: Number(response.data[0].lat),
      lng: Number(response.data[0].lon),
    };
  } catch (err) {
    console.log(err);
    return null;
  }
};

module.exports = geocodeAddress;
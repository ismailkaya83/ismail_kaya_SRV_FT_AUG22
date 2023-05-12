const express = require("express");

const router = express.Router();
const CyclicDB = require("@cyclic.sh/dynamodb");
const httpStatus = require("http-status");
const validate = require("../middlewares/validate");
const ApiError = require("../utils/ApiError");
const { createParticipant } = require("../validations/participantValidation");
let participants = CyclicDB.collection("participants");
const moment = require("moment");

router.get("/", async (req, res, next) => {
  try {
    const all = await participants.list();
    if (!all) {
      return res.status(httpStatus.OK).jsend.success([]);
    }
    return res.status(httpStatus.OK).jsend.success(all.results);
  } catch (err) {
    throw new ApiError(httpStatus.BAD_REQUEST, err.message);
  }
});

router.get("/details", async (req, res, next) => {
  try {
    let all = await participants.list();
    let results = [];
    await Promise.all(
      all.results.map(async (participant) => {
        const user = await participants.item(participant.key).get();
        if (user.props.active === false) return false;
        const workData = await participants
          .item(participant.key)
          .fragment("work")
          .get();

        const homeData = await participants
          .item(participant.key)
          .fragment("home")
          .get();

        const work = workData[0].props;
        const home = homeData[0].props;
        results.push({ user: user.props, work, home });
        return true;
      })
    );
    return res.status(httpStatus.OK).jsend.success(results);
  } catch (err) {
    return res.status(httpStatus.BAD_REQUEST).jsend.error({
      message: err.message,
    });
  }
});

router.get("/deleted", async (req, res, next) => {
  try {
    let all = await participants.list();
    let results = [];
    await Promise.all(
      all.results.map(async (participant) => {
        const user = await participants.item(participant.key).get();
        if (user.props.active === true) return false;
        const workData = await participants
          .item(participant.key)
          .fragment("work")
          .get();

        const homeData = await participants
          .item(participant.key)
          .fragment("home")
          .get();

        const work = workData[0].props;
        const home = homeData[0].props;
        results.push({ user: user.props, work, home });
        return true;
      })
    );
    return res.status(httpStatus.OK).jsend.success(results);
  } catch (err) {
    return res.status(httpStatus.BAD_REQUEST).jsend.error({
      message: err.message,
    });
  }
});

router.post("/add", validate(createParticipant), async (req, res, next) => {
  try {
    const {
      email,
      firstName,
      lastName,
      active,
      dob,
      companyName,
      salary,
      currency,
      country,
      city,
    } = req.body;
    const formattedDOB = moment(dob).format("YYYY/MM/DD");
    const isEmailTaken = await participants.item(email).get();
    if (isEmailTaken) {
      return res.status(httpStatus.BAD_REQUEST).jsend.error({
        message: "Email already taken",
      });
    }
    const participant = await participants.set(email, {
      firstName,
      lastName,
      active,
      dob: formattedDOB,
    });
    const work = await participants.item(email).fragment("work").set({
      companyName,
      salary,
      currency,
    });
    const home = await participants.item(email).fragment("home").set({
      country,
      city,
    });

    return res.status(httpStatus.CREATED).jsend.success({
      participant,
      work,
      home,
    });
  } catch (err) {
    throw new ApiError(httpStatus.BAD_REQUEST, err.message);
  }
});

router.put("/:email", validate(createParticipant), async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      active,
      companyName,
      salary,
      currency,
      country,
      city,
      dob,
    } = req.body;
    console.log(typeof dob);
    const formattedDOB = moment(dob).format("YYYY/MM/DD");
    const { email } = req.params;
    const newEmail = req.body.email;

    // Check if participant exists
    const accountExists = await participants.item(email).get();
    if (!accountExists) {
      return res.status(httpStatus.BAD_REQUEST).jsend.error({
        message: "Participant not found",
      });
    }

    // Check if email and newEmail are the same
    if (email !== newEmail) {
      // Check if newEmail is already taken
      const isEmailTaken = await participants.item(newEmail).get();
      if (isEmailTaken) {
        return res.status(httpStatus.BAD_REQUEST).jsend.error({
          message: "Email already taken",
        });
      }
      // Create new participant with newEmail
      const participant = await participants.set(newEmail, {
        firstName,
        lastName,
        active,
        dob : formattedDOB,
      });
      const work = await participants.item(newEmail).fragment("work").set({
        companyName,
        salary,
        currency,
      });
      const home = await participants.item(newEmail).fragment("home").set({
        country,
        city,
      });
      // Delete old participant
      await participants.item(email).set({
        active: false,
      });
      return res.status(httpStatus.OK).jsend.success({
        key: participant.key,
        participant: participant.props,
        work: work.props,
        home: home.props,
      });
    }

    // Update participant
    const participant = await participants.item(email).set({
      firstName,
      lastName,
      active,
      dob: formattedDOB,
    });
    const work = await participants.item(email).fragment("work").set({
      companyName,
      salary,
      currency,
    });
    const home = await participants.item(email).fragment("home").set({
      country,
      city,
    });
    return res.status(httpStatus.OK).jsend.success({
      key: participant.key,
      participant: participant.props,
      work: work.props,
      home: home.props,
    });
  } catch (err) {
    next(new ApiError(httpStatus.BAD_REQUEST, err.message));
  }
});

router.get("/details/:email", async (req, res, next) => {
  try {
    const email = req.params.email;
    const participant = await participants.item(email).get();
    if (!participant || (participant && participant.props.active === false)) {
      return res.status(httpStatus.NOT_FOUND).jsend.error({
        message: "Participant not found",
      });
    }
    const details = participant.props;
    return res.status(httpStatus.OK).jsend.success({
      key: participant.key,
      ...details,
    });
  } catch (err) {
    throw new ApiError(httpStatus.BAD_REQUEST, err.message);
  }
});

router.get("/work/:email", async (req, res, next) => {
  try {
    const email = req.params.email;
    const participant = await participants.item(email).get();
    if (!participant || (participant && participant.props.active === false)) {
      return res.status(httpStatus.NOT_FOUND).jsend.error({
        message: "Participant not found",
      });
    }
    const workData = await participants.item(email).fragment("work").get();
    const details = workData[0].props;
    return res.status(httpStatus.OK).jsend.success({
      key: participant.key,
      ...details,
    });
  } catch (err) {
    throw new ApiError(httpStatus.BAD_REQUEST, err.message);
  }
});

router.get("/home/:email", async (req, res, next) => {
  try {
    const email = req.params.email;
    const participant = await participants.item(email).get();
    if (!participant || (participant && participant.props.active === false)) {
      return res.status(httpStatus.NOT_FOUND).jsend.error({
        message: "Participant not found",
      });
    }
    const homeData = await participants.item(email).fragment("home").get();
    const details = homeData[0].props;
    return res.status(httpStatus.OK).jsend.success({
      key: participant.key,
      ...details,
    });
  } catch (err) {
    throw new ApiError(httpStatus.BAD_REQUEST, err.message);
  }
});

router.delete("/:email", async (req, res, next) => {
  try {
    const email = req.params.email;
    const participant = await participants.item(email).get();
    if (!participant) {
      return res.status(httpStatus.NOT_FOUND).jsend.error({
        message: "Participant not found",
      });
    }
    if (participant.props.active === false) {
      return res.status(httpStatus.BAD_REQUEST).jsend.error({
        message: "Participant already deleted",
      });
    }
    const deleted = await participants.item(email).set({ active: false });
    return res.status(httpStatus.OK).jsend.success({
      key: deleted.key,
      active: deleted.props.active,
      message: "Participant deleted successfully",
    });
  } catch (err) {
    throw new ApiError(httpStatus.BAD_REQUEST, err.message);
  }
});

module.exports = router;

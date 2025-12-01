const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userSchema');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "http://localhost:8080/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  console.log("✅ Raw Google profile:", JSON.stringify(profile, null, 2));

  if (!profile.emails || !profile.emails.length) {
    console.error(" Google profile missing emails");
    return done(new Error("No email received from Google"), null);
  }

  try {
    const email = (profile.emails[0].value || '').toLowerCase();
    const googleId = profile.id;
    const fullName = profile.displayName || `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim();
    const avatar = profile.photos?.[0]?.value || null;

    // Try by googleId
    let user = await User.findOne({ googleId });

    // Fallback to email
    if (!user) {
      user = await User.findOne({ email });
      if (user && !user.googleId) {
        // Link existing account with Google
        user.googleId = googleId;
        if (!user.profileImage && avatar) user.profileImage = avatar;
        await user.save();
      }
    }

    // Create if still not found
    if (!user) {
      user = await User.create({
        fullName: fullName || email.split('@')[0],
        email,
        googleId,
        profileImage: avatar,
        role: 'customer',
        referralCode: Math.random().toString(36).slice(2, 10).toUpperCase()
      });
    }

    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));


passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

module.exports = passport;
-- Phase 20.5: Letter collection (36 letters: A-Z + 10 special)
CREATE TABLE "letters" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "char" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "rarity" TEXT NOT NULL DEFAULT 'common',
    CONSTRAINT "letters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "letters_char_key" ON "letters"("char");

CREATE TABLE "student_letters" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "student_id" UUID NOT NULL,
    "letter_id" UUID NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "student_letters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_letters_student_id_letter_id_key" ON "student_letters"("student_id", "letter_id");
CREATE INDEX "student_letters_student_id_idx" ON "student_letters"("student_id");

ALTER TABLE "student_letters" ADD CONSTRAINT "student_letters_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_letters" ADD CONSTRAINT "student_letters_letter_id_fkey"
    FOREIGN KEY ("letter_id") REFERENCES "letters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed 36 letters (A-Z + 10 special placeholders)
INSERT INTO "letters" ("char", "image_url", "rarity") VALUES
    ('A', '/letters/A.png', 'common'),
    ('B', '/letters/B.png', 'common'),
    ('C', '/letters/C.png', 'common'),
    ('D', '/letters/D.png', 'common'),
    ('E', '/letters/E.png', 'common'),
    ('F', '/letters/F.png', 'common'),
    ('G', '/letters/G.png', 'common'),
    ('H', '/letters/H.png', 'common'),
    ('I', '/letters/I.png', 'common'),
    ('J', '/letters/J.png', 'rare'),
    ('K', '/letters/K.png', 'common'),
    ('L', '/letters/L.png', 'common'),
    ('M', '/letters/M.png', 'common'),
    ('N', '/letters/N.png', 'common'),
    ('O', '/letters/O.png', 'common'),
    ('P', '/letters/P.png', 'common'),
    ('Q', '/letters/Q.png', 'rare'),
    ('R', '/letters/R.png', 'common'),
    ('S', '/letters/S.png', 'common'),
    ('T', '/letters/T.png', 'common'),
    ('U', '/letters/U.png', 'common'),
    ('V', '/letters/V.png', 'rare'),
    ('W', '/letters/W.png', 'common'),
    ('X', '/letters/X.png', 'rare'),
    ('Y', '/letters/Y.png', 'common'),
    ('Z', '/letters/Z.png', 'rare'),
    ('STAR', '/letters/STAR.png', 'legendary'),
    ('MOON', '/letters/MOON.png', 'legendary'),
    ('SUN', '/letters/SUN.png', 'legendary'),
    ('HEART', '/letters/HEART.png', 'rare'),
    ('FIRE', '/letters/FIRE.png', 'rare'),
    ('GEM', '/letters/GEM.png', 'legendary'),
    ('CROWN', '/letters/CROWN.png', 'legendary'),
    ('TROPHY', '/letters/TROPHY.png', 'rare'),
    ('LIGHTNING', '/letters/LIGHTNING.png', 'rare'),
    ('RAINBOW', '/letters/RAINBOW.png', 'legendary');

USE callagent;

INSERT INTO agents (name, description, system_prompt, first_message, voice, voice_role, inbound_enabled, outbound_enabled, result_fields) VALUES
('Aziza - NPS aniqlovchi', 'Mijoz qoniqishini 1-10 ball bilan so''raydi',
 'Sen Aziza, kompaniyaning mijozlar bilan ishlash bo''limi operatorisan. Mijozdan xizmatimizni 1 dan 10 gacha baholashini so''ra. Agar baho 7 dan past bo''lsa, nima yoqmaganini muloyimlik bilan so''ra. Bahsga kirishma, rahmat ayt.',
 'Assalomu alaykum! Men Aziza, sizga qisqa savol bilan qo''ng''iroq qildim. Ikki daqiqa vaqtingiz bormi?',
 'zamira', 'friendly', 0, 1,
 '[{"name":"nps","description":"Mijoz bergan baho, 1 dan 10 gacha"},{"name":"izoh","description":"Mijozning fikri yoki shikoyati"}]'),
('Qabulxona', 'Kiruvchi qo''ng''iroqlarga javob beradi va murojaatni yozib oladi',
 'Sen kompaniya qabulxonasi operatorisan. Ish vaqti dushanbadan shanbagacha 9:00 dan 18:00 gacha. Mijozning ismi, telefon raqami va murojaat mavzusini aniqla. Bilmagan savolingga javob o''ylab topma: mutaxassis qayta qo''ng''iroq qilishini ayt.',
 'Assalomu alaykum, kompaniyamizga qo''ng''iroq qilganingiz uchun rahmat. Sizga qanday yordam bera olaman?',
 'nigora', '', 1, 0,
 '[{"name":"ism","description":"Mijozning ismi"},{"name":"telefon","description":"Qayta aloqa uchun raqam"},{"name":"mavzu","description":"Murojaat mavzusi qisqacha"}]');

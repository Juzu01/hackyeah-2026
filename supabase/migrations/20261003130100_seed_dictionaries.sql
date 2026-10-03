-- Reference data for the body map and the pain-type picker.

insert into public.body_parts (id, name_pl, region, side, sort_order) values
  ('head',       'Głowa',                      'head',  'center', 10),
  ('neck',       'Szyja',                      'head',  'center', 20),
  ('chest',      'Klatka piersiowa',           'torso', 'center', 30),
  ('abdomen',    'Brzuch',                     'torso', 'center', 40),
  ('upper_back', 'Górny odcinek pleców',       'torso', 'center', 50),
  ('lower_back', 'Dolny odcinek pleców',       'torso', 'center', 60),
  ('pelvis',     'Miednica',                   'torso', 'center', 70);

-- Paired parts get a _left and a _right row.
insert into public.body_parts (id, name_pl, region, side, sort_order)
select p.slug || '_' || s.side,
       p.name_pl || ' ' || s.suffix_pl,
       p.region,
       s.side,
       p.sort_order + s.offset_
from (values
  ('shoulder',   'Bark',             'arm', 100),
  ('upper_arm',  'Ramię',            'arm', 110),
  ('elbow',      'Łokieć',           'arm', 120),
  ('forearm',    'Przedramię',       'arm', 130),
  ('wrist',      'Nadgarstek',       'arm', 140),
  ('hand',       'Dłoń',             'arm', 150),
  ('hip',        'Biodro',           'leg', 200),
  ('groin',      'Pachwina',         'leg', 210),
  ('buttock',    'Pośladek',         'leg', 220),
  ('thigh_front','Udo (przód)',      'leg', 230),
  ('thigh_back', 'Udo (tył)',        'leg', 240),
  ('knee',       'Kolano',           'leg', 250),
  ('shin',       'Goleń',            'leg', 260),
  ('calf',       'Łydka',            'leg', 270),
  ('ankle',      'Kostka',           'leg', 280),
  ('foot',       'Stopa',            'leg', 290)
) as p (slug, name_pl, region, sort_order)
cross join (values
  ('left',  '(lewa strona)',  0),
  ('right', '(prawa strona)', 1)
) as s (side, suffix_pl, offset_);

insert into public.pain_types (id, name_pl, sort_order) values
  ('throbbing', 'Pulsujący',     10),
  ('stabbing',  'Kłujący',       20),
  ('sharp',     'Ostry',         30),
  ('dull',      'Tępy',          40),
  ('aching',    'Ćmiący',        50),
  ('burning',   'Piekący',       60),
  ('pressing',  'Uciskowy',      70),
  ('radiating', 'Promieniujący', 80),
  ('tearing',   'Rwący',         90),
  ('cramping',  'Skurczowy',     100),
  ('tingling',  'Mrowiący',      110);

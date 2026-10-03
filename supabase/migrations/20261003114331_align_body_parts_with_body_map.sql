-- The body map (src/body/anatomy.ts, buildBodyModel()) is the source of truth for body parts.
-- Its part ids look like 'biceps-left', 'rectusAbdominis', 'kidney-right'; replace the placeholder
-- dictionary with its 60 clickable parts.
--
-- Reports keep body_part_id without a foreign key on purpose: the map is still growing, and a part
-- added there must not break saving. body_parts stays a lookup for names (left join in analytics).

alter table public.pain_reports drop constraint pain_reports_body_part_id_fkey;
alter table public.pain_reports
  add constraint pain_reports_body_part_id_format check (body_part_id ~ '^[a-zA-Z]+(-(left|right))?$');

delete from public.body_parts;
alter table public.body_parts drop constraint body_parts_id_check;
alter table public.body_parts drop column region;
alter table public.body_parts
  add column info_key text not null, -- anatomy.ts INFO key, shared by the left and right copy
  add column latin    text not null,
  add column system   text not null check (system in ('muscle', 'organ'));
alter table public.body_parts
  add constraint body_parts_id_format check (id ~ '^[a-zA-Z]+(-(left|right))?$');

insert into public.body_parts (id, info_key, name_pl, latin, system, side, sort_order) values
  ('sternocleidomastoid-left', 'sternocleidomastoid', 'Mięsień mostkowo-obojczykowo-sutkowy', 'musculus sternocleidomastoideus', 'muscle', 'left', 10),
  ('sternocleidomastoid-right', 'sternocleidomastoid', 'Mięsień mostkowo-obojczykowo-sutkowy', 'musculus sternocleidomastoideus', 'muscle', 'right', 20),
  ('trapezius-left', 'trapezius', 'Mięsień czworoboczny', 'musculus trapezius', 'muscle', 'left', 30),
  ('trapezius-right', 'trapezius', 'Mięsień czworoboczny', 'musculus trapezius', 'muscle', 'right', 40),
  ('pectoralis-left', 'pectoralis', 'Mięsień piersiowy większy', 'musculus pectoralis major', 'muscle', 'left', 50),
  ('pectoralis-right', 'pectoralis', 'Mięsień piersiowy większy', 'musculus pectoralis major', 'muscle', 'right', 60),
  ('serratus-left', 'serratus', 'Mięsień zębaty przedni', 'musculus serratus anterior', 'muscle', 'left', 70),
  ('serratus-right', 'serratus', 'Mięsień zębaty przedni', 'musculus serratus anterior', 'muscle', 'right', 80),
  ('obliqueExternal-left', 'obliqueExternal', 'Mięsień skośny zewnętrzny brzucha', 'musculus obliquus externus abdominis', 'muscle', 'left', 90),
  ('obliqueExternal-right', 'obliqueExternal', 'Mięsień skośny zewnętrzny brzucha', 'musculus obliquus externus abdominis', 'muscle', 'right', 100),
  ('deltoid-left', 'deltoid', 'Mięsień naramienny', 'musculus deltoideus', 'muscle', 'left', 110),
  ('deltoid-right', 'deltoid', 'Mięsień naramienny', 'musculus deltoideus', 'muscle', 'right', 120),
  ('biceps-left', 'biceps', 'Mięsień dwugłowy ramienia', 'musculus biceps brachii', 'muscle', 'left', 130),
  ('biceps-right', 'biceps', 'Mięsień dwugłowy ramienia', 'musculus biceps brachii', 'muscle', 'right', 140),
  ('triceps-left', 'triceps', 'Mięsień trójgłowy ramienia', 'musculus triceps brachii', 'muscle', 'left', 150),
  ('triceps-right', 'triceps', 'Mięsień trójgłowy ramienia', 'musculus triceps brachii', 'muscle', 'right', 160),
  ('brachialis-left', 'brachialis', 'Mięsień ramienny', 'musculus brachialis', 'muscle', 'left', 170),
  ('brachialis-right', 'brachialis', 'Mięsień ramienny', 'musculus brachialis', 'muscle', 'right', 180),
  ('brachioradialis-left', 'brachioradialis', 'Mięsień ramienno-promieniowy', 'musculus brachioradialis', 'muscle', 'left', 190),
  ('brachioradialis-right', 'brachioradialis', 'Mięsień ramienno-promieniowy', 'musculus brachioradialis', 'muscle', 'right', 200),
  ('forearmFlexors-left', 'forearmFlexors', 'Zginacze nadgarstka i palców', 'musculi flexores antebrachii', 'muscle', 'left', 210),
  ('forearmFlexors-right', 'forearmFlexors', 'Zginacze nadgarstka i palców', 'musculi flexores antebrachii', 'muscle', 'right', 220),
  ('tensorFasciaeLatae-left', 'tensorFasciaeLatae', 'Mięsień napinacz powięzi szerokiej', 'musculus tensor fasciae latae', 'muscle', 'left', 230),
  ('tensorFasciaeLatae-right', 'tensorFasciaeLatae', 'Mięsień napinacz powięzi szerokiej', 'musculus tensor fasciae latae', 'muscle', 'right', 240),
  ('adductors-left', 'adductors', 'Mięśnie przywodziciele uda', 'musculi adductores', 'muscle', 'left', 250),
  ('adductors-right', 'adductors', 'Mięśnie przywodziciele uda', 'musculi adductores', 'muscle', 'right', 260),
  ('vastusLateralis-left', 'vastusLateralis', 'Mięsień obszerny boczny', 'musculus vastus lateralis', 'muscle', 'left', 270),
  ('vastusLateralis-right', 'vastusLateralis', 'Mięsień obszerny boczny', 'musculus vastus lateralis', 'muscle', 'right', 280),
  ('vastusMedialis-left', 'vastusMedialis', 'Mięsień obszerny przyśrodkowy', 'musculus vastus medialis', 'muscle', 'left', 290),
  ('vastusMedialis-right', 'vastusMedialis', 'Mięsień obszerny przyśrodkowy', 'musculus vastus medialis', 'muscle', 'right', 300),
  ('rectusFemoris-left', 'rectusFemoris', 'Mięsień prosty uda', 'musculus rectus femoris', 'muscle', 'left', 310),
  ('rectusFemoris-right', 'rectusFemoris', 'Mięsień prosty uda', 'musculus rectus femoris', 'muscle', 'right', 320),
  ('sartorius-left', 'sartorius', 'Mięsień krawiecki', 'musculus sartorius', 'muscle', 'left', 330),
  ('sartorius-right', 'sartorius', 'Mięsień krawiecki', 'musculus sartorius', 'muscle', 'right', 340),
  ('tibialisAnterior-left', 'tibialisAnterior', 'Mięsień piszczelowy przedni', 'musculus tibialis anterior', 'muscle', 'left', 350),
  ('tibialisAnterior-right', 'tibialisAnterior', 'Mięsień piszczelowy przedni', 'musculus tibialis anterior', 'muscle', 'right', 360),
  ('fibularisLongus-left', 'fibularisLongus', 'Mięsień strzałkowy długi', 'musculus fibularis longus', 'muscle', 'left', 370),
  ('fibularisLongus-right', 'fibularisLongus', 'Mięsień strzałkowy długi', 'musculus fibularis longus', 'muscle', 'right', 380),
  ('gastrocnemius-left', 'gastrocnemius', 'Mięsień brzuchaty łydki', 'musculus gastrocnemius', 'muscle', 'left', 390),
  ('gastrocnemius-right', 'gastrocnemius', 'Mięsień brzuchaty łydki', 'musculus gastrocnemius', 'muscle', 'right', 400),
  ('soleus-left', 'soleus', 'Mięsień płaszczkowaty', 'musculus soleus', 'muscle', 'left', 410),
  ('soleus-right', 'soleus', 'Mięsień płaszczkowaty', 'musculus soleus', 'muscle', 'right', 420),
  ('rectusAbdominis', 'rectusAbdominis', 'Mięsień prosty brzucha', 'musculus rectus abdominis', 'muscle', 'center', 430),
  ('brain', 'brain', 'Mózg', 'encephalon', 'organ', 'center', 440),
  ('thyroid', 'thyroid', 'Tarczyca', 'glandula thyroidea', 'organ', 'center', 450),
  ('trachea', 'trachea', 'Tchawica', 'trachea', 'organ', 'center', 460),
  ('esophagus', 'esophagus', 'Przełyk', 'oesophagus', 'organ', 'center', 470),
  ('lungRight', 'lungRight', 'Płuco prawe', 'pulmo dexter', 'organ', 'right', 480),
  ('lungLeft', 'lungLeft', 'Płuco lewe', 'pulmo sinister', 'organ', 'left', 490),
  ('heart', 'heart', 'Serce', 'cor', 'organ', 'center', 500),
  ('liver', 'liver', 'Wątroba', 'hepar', 'organ', 'center', 510),
  ('gallbladder', 'gallbladder', 'Pęcherzyk żółciowy', 'vesica biliaris', 'organ', 'center', 520),
  ('stomach', 'stomach', 'Żołądek', 'gaster', 'organ', 'center', 530),
  ('spleen', 'spleen', 'Śledziona', 'lien', 'organ', 'center', 540),
  ('pancreas', 'pancreas', 'Trzustka', 'pancreas', 'organ', 'center', 550),
  ('kidney-left', 'kidney', 'Nerka', 'ren', 'organ', 'left', 560),
  ('kidney-right', 'kidney', 'Nerka', 'ren', 'organ', 'right', 570),
  ('smallIntestine', 'smallIntestine', 'Jelito cienkie', 'intestinum tenue', 'organ', 'center', 580),
  ('largeIntestine', 'largeIntestine', 'Jelito grube', 'intestinum crassum', 'organ', 'center', 590),
  ('bladder', 'bladder', 'Pęcherz moczowy', 'vesica urinaria', 'organ', 'center', 600);

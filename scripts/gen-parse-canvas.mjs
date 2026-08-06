import fs from "fs";

const data = JSON.parse(fs.readFileSync("tmp-canvas-data.json", "utf8"));

// clean leaked context from q25 option D
const q25 = data.questions.find((q) => q.id === 25);
if (q25) {
  const d = q25.options.find((o) => o.id === "D");
  if (d && d.label.includes("КОНТЕКСТ")) {
    d.label = d.label.split("КОНТЕКСТ")[0].trim();
  }
}

const dataLiteral = JSON.stringify(data, null, 2);

const source = `import {
  BarChart,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Code,
  Divider,
  Grid,
  H1,
  H2,
  Pill,
  Row,
  Select,
  Stack,
  Stat,
  Table,
  Text,
  useCanvasState,
} from "cursor/canvas";

const DATA = ${dataLiteral};

const TYPE_LABEL: Record<string, string> = {
  single_choice: "Одиночный",
  matching: "Сопоставление",
  multiple_choice: "Множественный",
};

const TYPE_TONE: Record<string, "neutral" | "info" | "success" | "warning"> = {
  single_choice: "info",
  matching: "warning",
  multiple_choice: "success",
};

type Q = (typeof DATA.questions)[number];

export default function PdfParseDemo() {
  const [selectedId, setSelectedId] = useCanvasState<string>("qid", "1");
  const selected: Q =
    DATA.questions.find((q) => String(q.id) === selectedId) ?? DATA.questions[0];

  const chartCats = ["single", "matching", "multi"];
  const chartVals = [
    DATA.byType.single_choice,
    DATA.byType.matching,
    DATA.byType.multiple_choice,
  ];

  return (
    <Stack gap={20} style={{ padding: 16, maxWidth: 960 }}>
      <Stack gap={6}>
        <H1>Парсинг PDF → JSON</H1>
        <Text tone="secondary" size="small">
          Источник: {DATA.source} · {DATA.pages} стр. · {DATA.chars} символов
          текста
        </Text>
      </Stack>

      <Callout tone="info" title="Как это работает">
        Текст извлекается из PDF (pdf-parse), затем regex режет секции и
        вопросы. Правильных ответов в файле нет — их нужно добавить вручную.
        Картинки распознаются только по словам «сурет / карта / кесте» в тексте.
      </Callout>

      <Grid columns={4} gap={12}>
        <Stat value={String(DATA.questions.length)} label="Вопросов" />
        <Stat
          value={String(DATA.byType.single_choice)}
          label="Одиночный"
          tone="info"
        />
        <Stat
          value={String(DATA.byType.matching)}
          label="Сопоставление"
          tone="warning"
        />
        <Stat
          value={String(DATA.byType.multiple_choice)}
          label="Множественный"
          tone="success"
        />
      </Grid>

      <H2>Пайплайн</H2>
      <Stack gap={8}>
        {DATA.steps.map((s) => (
          <Row key={s.step} gap={10} align="center">
            <Pill size="small" tone="neutral">
              {String(s.step)}
            </Pill>
            <Text weight="semibold">{s.name}</Text>
            <Text tone="secondary" size="small">
              {s.detail}
            </Text>
          </Row>
        ))}
      </Stack>

      <Divider />

      <Grid columns={2} gap={16}>
        <Card>
          <CardHeader>Типы вопросов</CardHeader>
          <CardBody>
            <BarChart
              categories={chartCats}
              series={[{ name: "Кол-во", data: chartVals }]}
              height={180}
            />
            <Text tone="secondary" size="small">
              Source: parser · файл {DATA.source}
            </Text>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>Секции PDF</CardHeader>
          <CardBody>
            <Table
              headers={["Секция", "Ключ", "Символов"]}
              rows={DATA.sections.map((s) => [
                s.label,
                s.key,
                String(s.chars),
              ])}
            />
          </CardBody>
        </Card>
      </Grid>

      {DATA.contexts.length > 0 ? (
        <Card>
          <CardHeader>Контекст «{DATA.contexts[0].title}»</CardHeader>
          <CardBody>
            <Text size="small">{DATA.contexts[0].text}</Text>
          </CardBody>
        </Card>
      ) : null}

      <H2>Все вопросы ({DATA.questions.length})</H2>
      <Table
        headers={["№", "Тип", "Текст", "Вар.", "Картинка?"]}
        rows={DATA.questions.map((q) => [
          String(q.id),
          TYPE_LABEL[q.type] ?? q.type,
          q.text.length > 70 ? q.text.slice(0, 70) + "…" : q.text,
          String(q.options.length),
          q.hasImageHint ? "да" : "—",
        ])}
        rowTone={DATA.questions.map((q) =>
          q.hasImageHint ? ("warning" as const) : undefined,
        )}
      />

      <H2>Разбор одного вопроса</H2>
      <Select
        value={selectedId}
        onChange={setSelectedId}
        options={DATA.questions.map((q) => ({
          value: String(q.id),
          label:
            "№" +
            q.id +
            " · " +
            (TYPE_LABEL[q.type] ?? q.type) +
            " · " +
            q.text.slice(0, 48),
        }))}
      />

      <Card>
        <CardHeader
          trailing={
            <Pill tone={TYPE_TONE[selected.type] ?? "neutral"} size="small">
              {TYPE_LABEL[selected.type] ?? selected.type}
            </Pill>
          }
        >
          Вопрос №{selected.id}
        </CardHeader>
        <CardBody>
          <Stack gap={12}>
            <Text weight="semibold">{selected.text}</Text>
            {selected.hasImageHint ? (
              <Callout tone="warning" title="Нужна картинка">
                В тексте есть «сурет/карта/кесте» — изображение из PDF пока не
                извлекается автоматически.
              </Callout>
            ) : null}
            {"rows" in selected && selected.rows ? (
              <Stack gap={4}>
                <Text size="small" weight="semibold">
                  Строки (слева)
                </Text>
                <Table
                  headers={["ID", "Текст"]}
                  rows={selected.rows.map((r) => [r.id, r.label])}
                />
              </Stack>
            ) : null}
            <Stack gap={4}>
              <Text size="small" weight="semibold">
                Варианты
              </Text>
              <Table
                headers={["", "Ответ"]}
                rows={selected.options.map((o) => [o.id, o.label])}
              />
            </Stack>
            <Stack gap={4}>
              <Text size="small" weight="semibold">
                JSON (фрагмент)
              </Text>
              <Code>
                {JSON.stringify(
                  {
                    id: selected.id,
                    type: selected.type,
                    text: selected.text,
                    ...("rows" in selected && selected.rows
                      ? { rows: selected.rows }
                      : {}),
                    options: selected.options,
                  },
                  null,
                  2,
                )}
              </Code>
            </Stack>
          </Stack>
        </CardBody>
      </Card>

      <Text tone="secondary" size="small">
        Canvas · демо парсера · правильные ответы в PDF отсутствуют
      </Text>
    </Stack>
  );
}
`;

const out =
  "C:/Users/sheri/.cursor/projects/c-PROB/canvases/pdf-parse-demo.canvas.tsx";
fs.writeFileSync(out, source, "utf8");
console.log("wrote", out, fs.statSync(out).size);

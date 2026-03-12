import { clsx } from "clsx";
import BarChartComponent from "../charts/BarChart";
import LineChartComponent from "../charts/LineChart";
import PieChartComponent from "../charts/PieChart";

interface ContentBlock {
  type: string;
  content: string;
  items?: string[];
  attrs?: Record<string, unknown>;
}

interface SlideProps {
  title: string;
  layout: string;
  blocks: ContentBlock[];
  isPresenting?: boolean;
}

function BlockRenderer({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "heading":
      return (
        <h2 className="text-2xl font-bold text-compass-text mb-4">
          {block.content}
        </h2>
      );
    case "text":
      return (
        <p className="text-base text-compass-text/80 leading-relaxed mb-3">
          {block.content}
        </p>
      );
    case "bullet_list":
      return (
        <ul className="space-y-2 mb-4">
          {(block.items || []).map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-compass-text/80">
              <span className="text-compass-accent mt-1.5 text-xs">●</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case "quote":
      return (
        <blockquote className="border-l-4 border-compass-accent/40 pl-4 py-2 mb-4">
          <p className="text-lg italic text-compass-text/70">{block.content}</p>
          {block.attrs?.attribution != null && (
            <cite className="text-sm text-compass-muted mt-2 block">
              — {String(block.attrs.attribution)}
            </cite>
          )}
        </blockquote>
      );
    case "chart_spec": {
      const chartData = block.attrs?.data as Record<string, unknown>[] | undefined;
      const chartType = (block.attrs?.type as string) || "bar";
      const xKey = (block.attrs?.x_key as string) || "label";
      const yKeys = (block.attrs?.y_keys as string[]) || ["value"];

      if (chartData && chartData.length > 0) {
        return (
          <div className="bg-compass-bg/50 rounded-lg p-4 mb-4 border border-compass-border">
            <p className="text-sm font-medium text-compass-accent mb-3">{block.content}</p>
            {chartType === "pie" ? (
              <PieChartComponent
                data={chartData.map((d) => ({
                  name: String(d[xKey] ?? ""),
                  value: Number(d[yKeys[0]] ?? 0),
                }))}
                height={220}
              />
            ) : chartType === "line" ? (
              <LineChartComponent
                data={chartData}
                xKey={xKey}
                yKeys={yKeys}
                height={220}
              />
            ) : (
              <BarChartComponent
                data={chartData}
                xKey={xKey}
                yKeys={yKeys}
                height={220}
              />
            )}
          </div>
        );
      }

      return (
        <div className="bg-compass-bg/50 rounded-lg p-6 mb-4 border border-compass-border">
          <p className="text-sm font-medium text-compass-accent mb-1">
            📊 {block.content}
          </p>
          {block.attrs?.description != null && (
            <p className="text-xs text-compass-muted">
              {String(block.attrs.description)}
            </p>
          )}
        </div>
      );
    }
    case "image_placeholder":
      return (
        <div className="bg-compass-bg/30 rounded-lg p-8 mb-4 border-2 border-dashed border-compass-border flex items-center justify-center">
          <p className="text-sm text-compass-muted">{block.content}</p>
        </div>
      );
    case "evidence_citation":
      return (
        <span className="inline-block bg-compass-accent/15 text-compass-accent text-xs rounded px-2 py-1 mb-2">
          {block.content}
        </span>
      );
    default:
      return <p className="text-compass-text/80 mb-2">{block.content}</p>;
  }
}

function TitleLayout({ title, blocks }: SlideProps) {
  const subtitleBlock = blocks.find((b) => b.type === "text");
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-12">
      <h1 className="text-4xl font-bold text-compass-text mb-4">{title}</h1>
      {subtitleBlock && (
        <p className="text-xl text-compass-muted max-w-2xl">
          {subtitleBlock.content}
        </p>
      )}
    </div>
  );
}

function ContentLayout({ title, blocks }: SlideProps) {
  return (
    <div className="flex flex-col h-full px-10 py-8">
      <h2 className="text-3xl font-bold text-compass-text mb-6">{title}</h2>
      <div className="flex-1">
        {blocks.map((block, i) => (
          <BlockRenderer key={i} block={block} />
        ))}
      </div>
    </div>
  );
}

function TwoColumnLayout({ title, blocks }: SlideProps) {
  const mid = Math.ceil(blocks.length / 2);
  const left = blocks.slice(0, mid);
  const right = blocks.slice(mid);

  return (
    <div className="flex flex-col h-full px-10 py-8">
      <h2 className="text-3xl font-bold text-compass-text mb-6">{title}</h2>
      <div className="flex-1 grid grid-cols-2 gap-8">
        <div>
          {left.map((block, i) => (
            <BlockRenderer key={i} block={block} />
          ))}
        </div>
        <div>
          {right.map((block, i) => (
            <BlockRenderer key={i} block={block} />
          ))}
        </div>
      </div>
    </div>
  );
}

function QuoteLayout({ title, blocks }: SlideProps) {
  const quoteBlock = blocks.find((b) => b.type === "quote") || blocks[0];
  return (
    <div className="flex flex-col items-center justify-center h-full px-16 text-center">
      {title && (
        <h2 className="text-2xl font-bold text-compass-text mb-8">{title}</h2>
      )}
      {quoteBlock && (
        <div>
          <p className="text-2xl italic text-compass-text/70 mb-4">
            &ldquo;{quoteBlock.content}&rdquo;
          </p>
          {quoteBlock.attrs?.attribution != null && (
            <cite className="text-base text-compass-muted">
              — {String(quoteBlock.attrs.attribution)}
            </cite>
          )}
        </div>
      )}
    </div>
  );
}

function ChartLayout({ title, blocks }: SlideProps) {
  const chartBlock = blocks.find((b) => b.type === "chart_spec");
  const otherBlocks = blocks.filter((b) => b.type !== "chart_spec");

  return (
    <div className="flex flex-col h-full px-10 py-8">
      <h2 className="text-3xl font-bold text-compass-text mb-6">{title}</h2>
      <div className="flex-1 flex flex-col">
        {chartBlock && (
          <div className="flex-1 bg-compass-bg/50 rounded-lg p-6 border border-compass-border mb-4 flex items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-medium text-compass-accent mb-2">
                {chartBlock.content}
              </p>
              {chartBlock.attrs?.description != null && (
                <p className="text-sm text-compass-muted">
                  {String(chartBlock.attrs.description)}
                </p>
              )}
            </div>
          </div>
        )}
        {otherBlocks.map((block, i) => (
          <BlockRenderer key={i} block={block} />
        ))}
      </div>
    </div>
  );
}

function ImageLeftLayout({ title, blocks }: SlideProps) {
  const imageBlock = blocks.find((b) => b.type === "image_placeholder");
  const otherBlocks = blocks.filter((b) => b.type !== "image_placeholder");

  return (
    <div className="flex flex-col h-full px-10 py-8">
      <h2 className="text-3xl font-bold text-compass-text mb-6">{title}</h2>
      <div className="flex-1 grid grid-cols-2 gap-8">
        <div className="flex items-center">
          {imageBlock ? (
            <div className="w-full bg-compass-bg/30 rounded-lg p-8 border-2 border-dashed border-compass-border flex items-center justify-center aspect-video">
              <p className="text-sm text-compass-muted text-center">
                {imageBlock.content}
              </p>
            </div>
          ) : (
            <div className="w-full bg-compass-bg/30 rounded-lg aspect-video border-2 border-dashed border-compass-border" />
          )}
        </div>
        <div>
          {otherBlocks.map((block, i) => (
            <BlockRenderer key={i} block={block} />
          ))}
        </div>
      </div>
    </div>
  );
}

const LAYOUTS: Record<string, React.FC<SlideProps>> = {
  title: TitleLayout,
  content: ContentLayout,
  "two-column": TwoColumnLayout,
  quote: QuoteLayout,
  chart: ChartLayout,
  "image-left": ImageLeftLayout,
};

export default function SlideLayout({
  title,
  layout,
  blocks,
  isPresenting = false,
}: SlideProps) {
  const LayoutComponent = LAYOUTS[layout] || ContentLayout;

  return (
    <div
      className={clsx(
        "bg-compass-card border border-compass-border rounded-xl overflow-hidden",
        isPresenting ? "w-full h-full" : "aspect-[16/9]",
      )}
    >
      <LayoutComponent
        title={title}
        layout={layout}
        blocks={blocks}
        isPresenting={isPresenting}
      />
    </div>
  );
}

export { BlockRenderer };
export type { ContentBlock, SlideProps };

"use client"

import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent
} from "@/components/ui/chart"
import { useEffect, useState } from "react"
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    XAxis,
    YAxis
} from "recharts"

// Chart colors
const COLORS = [
    "#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8",
    "#82CA9D", "#FFC658", "#8DD1E1", "#A4DE6C", "#D0ED57"
]

interface DataChartProps {
    data: any
    title?: string
}

export default function DataChart({ data, title = "Query Results" }: DataChartProps) {
    const [chartType, setChartType] = useState<"bar" | "line">("bar")
    const [chartData, setChartData] = useState<any[]>([])
    const [chartKeys, setChartKeys] = useState<string[]>([])
    const [categoryKey, setCategoryKey] = useState<string>("")

    // Determine the best chart type and prepare data
    useEffect(() => {
        if (!data || !Array.isArray(data) || data.length === 0) {
            return
        }

        try {
            // Parse the data if it's a string
            const parsedData = typeof data === "string" ? JSON.parse(data) : data

            if (!Array.isArray(parsedData) || parsedData.length === 0) {
                return
            }

            // Prepare data for visualization
            const formattedData = parsedData.map((row, index) => {
                // If row is an array, convert to object
                if (Array.isArray(row)) {
                    const obj: Record<string, any> = { id: index }
                    row.forEach((value, i) => {
                        obj[`value${i}`] = value
                    })
                    return obj
                }
                // If row is already an object, add id if missing
                return { id: index, ...row }
            })

            // Get all keys except 'id'
            const allKeys = Object.keys(formattedData[0]).filter(key => key !== 'id')

            // Determine category key (first key) and value keys
            const firstKey = allKeys[0]
            const valueKeys = allKeys.slice(1)

            // Determine best chart type based on data characteristics
            let bestChartType: "bar" | "line" = "bar"

            // If we have time-series or sequential data, use line chart
            if (
                formattedData.length > 5 &&
                (firstKey.toLowerCase().includes('date') ||
                    firstKey.toLowerCase().includes('time') ||
                    firstKey.toLowerCase().includes('year') ||
                    firstKey.toLowerCase().includes('month'))
            ) {
                bestChartType = "line"
            }

            setChartType(bestChartType)
            setChartData(formattedData)
            setChartKeys(valueKeys)
            setCategoryKey(firstKey)
        } catch (error) {
            console.error("Error preparing chart data:", error)
        }
    }, [data])

    // Render appropriate chart based on type
    const renderChart = () => {
        if (!chartData || chartData.length === 0 || chartKeys.length === 0) {
            return <div className="flex items-center justify-center h-64">No data available for visualization</div>
        }

        const config = chartKeys.reduce((acc, key, index) => {
            acc[key] = {
                label: key,
                color: COLORS[index % COLORS.length]
            }
            return acc
        }, {} as Record<string, { label: string, color: string }>)

        switch (chartType) {
            case "line":
                return (
                    <ChartContainer className="h-full min-h-[400px] w-full" config={config}>
                        <LineChart data={chartData} width={800} height={400} className="mx-auto">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey={categoryKey} />
                            <YAxis />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Legend />
                            {chartKeys.map((key, index) => (
                                <Line
                                    key={key}
                                    type="monotone"
                                    dataKey={key}
                                    stroke={COLORS[index % COLORS.length]}
                                    activeDot={{ r: 8 }}
                                />
                            ))}
                        </LineChart>
                    </ChartContainer>
                )

            case "bar":
            default:
                return (
                    <ChartContainer className="h-full min-h-[400px] w-full" config={config}>
                        <BarChart data={chartData} width={800} height={400} className="mx-auto">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey={categoryKey} />
                            <YAxis />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Legend />
                            {chartKeys.map((key, index) => (
                                <Bar
                                    key={key}
                                    dataKey={key}
                                    fill={COLORS[index % COLORS.length]}
                                />
                            ))}
                        </BarChart>
                    </ChartContainer>
                )
        }
    }

    // Generate a summary of the chart data
    const generateSummary = () => {
        if (!chartData || chartData.length === 0) return null;

        try {
            let summary = `Found ${chartData.length} results.`;

            // Add more specific insights based on chart type
            const categoryValues = chartData.map(item => item[categoryKey]);
            const uniqueCategories = [...new Set(categoryValues)].length;
            summary += ` Showing data for ${uniqueCategories} unique ${categoryKey} values.`;

            return summary;
        } catch (error) {
            console.error("Error generating summary:", error);
            return null;
        }
    };

    return (
        <div className="w-full">
            <div className="flex justify-end mb-4 space-x-2">
                <button
                    onClick={() => setChartType("bar")}
                    className={`px-3 py-1 text-sm rounded ${chartType === "bar" ? "bg-black text-white" : "bg-gray-200"}`}
                >
                    Bar
                </button>
                <button
                    onClick={() => setChartType("line")}
                    className={`px-3 py-1 text-sm rounded ${chartType === "line" ? "bg-black text-white" : "bg-gray-200"}`}
                >
                    Line
                </button>
            </div>

            <div className="bg-white p-4 rounded-lg border">
                <h2 className="text-xl font-bold text-center mb-4">{chartData.length} RESULTS</h2>
                <div className="h-[400px] w-full">
                    {renderChart()}
                </div>
                {generateSummary() && (
                    <p className="text-sm text-gray-600 mt-4">
                        {generateSummary()}
                    </p>
                )}
            </div>
        </div>
    )
}

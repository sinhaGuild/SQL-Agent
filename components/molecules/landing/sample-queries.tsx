"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useState } from "react"

interface SampleQuery {
    title: string
    description: string
    query: string
}

const SAMPLE_QUERIES: SampleQuery[] = [
    // Sanskriti DB Queries
    {
        title: "Tag Analysis",
        description: "Find stories with rich tagging metadata.",
        query: "Find stories with a significantly higher number of tags compared to the average for their category in sanskriti_db, suggesting potential outliers in tagging behavior."
    },
    {
        title: "Temporal Trends",
        description: "Analyze story creation patterns over time.",
        query: "Identify the year or decade with the highest growth in the number of stories created compared to the previous year in sanskriti_db."
    },
    {
        title: "Content Analysis",
        description: "Explore thematic elements in stories.",
        query: "Calculate the percentage of stories in each cluster that contain the word 'love' in their prose in sanskriti_db."
    },
    {
        title: "Art Objects Timeline",
        description: "Analyze the historical span of art objects.",
        query: "Find the top 5 cultures with the largest time span between the earliest and latest object_begin_date in the ss_the_met.objects dataset."
    },
    {
        title: "Artist Analysis",
        description: "Explore artist productivity across time.",
        query: "For each artist (artist_display_name), calculate the time span between their earliest and latest created object in ss_the_met.objects, considering only artists with at least 10 objects in the dataset."
    },
    // Additional queries (will be hidden initially)
    {
        title: "Regional Art Distribution",
        description: "Compare art objects across regions.",
        query: "Find the top 5 regions with the highest ratio of highlighted objects (is_highlight = TRUE) to the total number of objects in that region in ss_the_met.objects."
    },
    {
        title: "Medium Analysis",
        description: "Explore art mediums across different periods.",
        query: "What is the earliest and latest object date for each distinct medium in the ss_the_met.objects dataset?"
    },
    {
        title: "Story Clusters",
        description: "Analyze story clusters and their characteristics.",
        query: "For each cluster, find the week with the largest difference between the number of stories created in that week and the average number of stories created per week in that cluster in sanskriti_db."
    },
    {
        title: "Correlation Analysis",
        description: "Find correlations between story attributes.",
        query: "Calculate the correlation between the year of creation and the length of story headings for stories in the 'Mythology' category in sanskriti_db."
    },
    {
        title: "Top Contributors",
        description: "Identify prolific story contributors.",
        query: "Find the user who has contributed the most stories across all categories, excluding stories with 'Folklore' as a tag in sanskriti_db."
    },
    {
        title: "Subcategory Analysis",
        description: "Compare story descriptions across subcategories.",
        query: "Find the top 3 subcategories with the longest average story descriptions within each category, considering only stories created after 2015 in sanskriti_db."
    },
    {
        title: "Artist Lifespan Analysis",
        description: "Analyze artist lifespans by region.",
        query: "Identify artists whose lifespan (difference between artist_begin_date and artist_end_date) are outliers compared to the average lifespan of artists in the same region in ss_the_met.objects."
    },
    {
        title: "Title Length Analysis",
        description: "Explore object title lengths by department.",
        query: "Find objects with unusually long titles compared to the average title length for their respective departments in ss_the_met.objects."
    },
    {
        title: "Highlighted Objects",
        description: "Analyze highlighted objects by country.",
        query: "What is the percentage of objects in each country that are classified as 'Painting' and have a credit line starting with 'Gift of' in ss_the_met.objects?"
    },
    {
        title: "Object Date Percentiles",
        description: "Statistical analysis of object dates.",
        query: "What is the 90th percentile of the difference between object_end_date and object_begin_date for objects made in the USA in ss_the_met.objects?"
    }
]

interface SampleQueriesProps {
    onSelectQuery: (query: string) => void
}

export default function SampleQueries({ onSelectQuery }: SampleQueriesProps) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [showAll, setShowAll] = useState(false);

    // Number of queries to show initially
    const initialQueryCount = 6;

    // Queries to display based on showAll state
    const displayedQueries = showAll
        ? SAMPLE_QUERIES
        : SAMPLE_QUERIES.slice(0, initialQueryCount);

    return (
        <div className="w-full mt-8">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold">Sample Queries</h2>
                <button
                    onClick={() => setShowAll(!showAll)}
                    className="px-4 py-2 text-sm font-medium rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                >
                    {showAll ? "Show Less" : "Show More"}
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedQueries.map((query, index) => (
                    <Card
                        key={index}
                        className={`cursor-pointer transition-all duration-200 ${hoveredIndex === index ? "border-primary shadow-md" : ""
                            }`}
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        onClick={() => onSelectQuery(query.query)}
                    >
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg">{query.title}</CardTitle>
                            <CardDescription>{query.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground italic">"{query.query}"</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

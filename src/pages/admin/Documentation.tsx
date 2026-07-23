import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDocumentation, useCreateDocumentationPage, useUpdateDocumentationPage } from "@/hooks/useDocumentation";
import { Book, Code, Plus, Search } from "lucide-react";

export default function Documentation() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPage, setSelectedPage] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    page_key: "",
    title: "",
    content: "",
    category: "instruction",
    subcategory: "",
  });

  const { data: apiDocs } = useDocumentation("api");
  const { data: instructions } = useDocumentation("instruction");
  const createPage = useCreateDocumentationPage();
  const updatePage = useUpdateDocumentationPage();

  const handleSave = async () => {
    if (selectedPage) {
      await updatePage.mutateAsync({ id: selectedPage.id, data: formData });
    } else {
      await createPage.mutateAsync(formData);
    }
    setIsEditing(false);
    setSelectedPage(null);
  };

  const handleEdit = (page: any) => {
    setSelectedPage(page);
    setFormData({
      page_key: page.page_key,
      title: page.title,
      content: page.content,
      category: page.category,
      subcategory: page.subcategory || "",
    });
    setIsEditing(true);
  };

  const handleNew = (category: string) => {
    setSelectedPage(null);
    setFormData({
      page_key: "",
      title: "",
      content: "",
      category,
      subcategory: "",
    });
    setIsEditing(true);
  };

  const filteredApiDocs = apiDocs?.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredInstructions = instructions?.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Documentation</h1>
          <p className="text-muted-foreground">
            API documentation and user instructions
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search documentation..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <Tabs defaultValue="api" className="space-y-4">
        <TabsList>
          <TabsTrigger value="api">
            <Code className="mr-2 h-4 w-4" />
            API Documentation
          </TabsTrigger>
          <TabsTrigger value="instructions">
            <Book className="mr-2 h-4 w-4" />
            User Instructions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="api" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">API Endpoints</h2>
            <Button onClick={() => handleNew("api")}>
              <Plus className="mr-2 h-4 w-4" />
              Add API Doc
            </Button>
          </div>

          <div className="grid gap-4">
            {filteredApiDocs?.map((doc) => (
              <Card key={doc.id} className="cursor-pointer hover:bg-accent" onClick={() => handleEdit(doc)}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {doc.title}
                    <span className="text-sm text-muted-foreground">{doc.subcategory}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {doc.content.slice(0, 200)}...
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="instructions" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">User Instructions</h2>
            <Button onClick={() => handleNew("instruction")}>
              <Plus className="mr-2 h-4 w-4" />
              Add Instruction
            </Button>
          </div>

          <div className="grid gap-4">
            {filteredInstructions?.map((doc) => (
              <Card key={doc.id} className="cursor-pointer hover:bg-accent" onClick={() => handleEdit(doc)}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {doc.title}
                    <span className="text-sm text-muted-foreground">{doc.subcategory}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {doc.content.slice(0, 200)}...
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle>{selectedPage ? "Edit" : "Create"} Documentation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Page Key</label>
              <Input
                value={formData.page_key}
                onChange={(e) => setFormData({ ...formData, page_key: e.target.value })}
                placeholder="e.g., api-courses-list"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Title</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Get Course List"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Subcategory</label>
              <Input
                value={formData.subcategory}
                onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                placeholder="e.g., Courses, Students"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Content (Markdown)</label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Write your documentation in markdown..."
                rows={15}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave}>Save</Button>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}